import JellyfinAPI from '@server/api/jellyfin';
import PlexTvAPI from '@server/api/plextv';
import { ApiErrorCode } from '@server/constants/error';
import { MediaServerType, ServerType } from '@server/constants/server';
import { UserType } from '@server/constants/user';
import { getRepository } from '@server/datasource';
import { OidcAccount } from '@server/entity/OidcAccount';
import { User } from '@server/entity/User';
import { startJobs } from '@server/job/schedule';
import {
  createOidcPending,
  getAuthorizationUrl,
  handleCallback,
} from '@server/lib/oidc';
import { Permission } from '@server/lib/permissions';
import type { OidcGroupMapping } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { checkAvatarChanged } from '@server/routes/avatarproxy';
import { ApiError } from '@server/types/error';
import { getAppVersion } from '@server/utils/appVersion';
import { getHostname } from '@server/utils/getHostname';
import axios from 'axios';
import { Router } from 'express';
import gravatarUrl from 'gravatar-url';
import net from 'net';
import validator from 'validator';

const authRoutes = Router();

const LOGIN_ERROR_REDIRECT = '/login?error=auth_failed';

/** Origin (scheme + host) of the configured OIDC issuer for redirect allowlist. */
function getOidcIssuerOrigin(oidc: {
  issuerUrl?: string;
  issuer?: string;
  authorizationUrl?: string;
}): string | null {
  const raw =
    oidc.issuerUrl?.trim() ||
    oidc.issuer?.trim() ||
    oidc.authorizationUrl?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return u.origin;
  } catch {
    return null;
  }
}

// function decodeJwtPayload(token: string): Record<string, unknown> | null {
//   try {
//     const parts = token.split('.');
//     if (parts.length !== 3) return null;
//     const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
//     const decoded = Buffer.from(payload, 'base64').toString('utf-8');
//     return JSON.parse(decoded) as Record<string, unknown>;
//   } catch {
//     return null;
//   }
// }

function groupsFromClaims(
  claims: Record<string, unknown>,
  groupsClaim: string
): string[] {
  const raw = claims[groupsClaim];
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === 'string');
  }
  if (typeof raw === 'string') return [raw];
  return [];
}

function computePermissionsFromGroups(
  groups: string[],
  groupMappings: OidcGroupMapping[],
  defaultPermissions: number
): number {
  if (!groupMappings.length || !groups.length) return defaultPermissions;
  let permissions = 0;
  const groupSet = new Set(groups.map((g) => g.trim().toLowerCase()));
  for (const { oidcGroup, permissions: perm } of groupMappings) {
    if (groupSet.has(oidcGroup.trim().toLowerCase())) {
      permissions |= perm;
    }
  }
  return permissions || defaultPermissions;
}

/** Build object of claims to store from token; only keys in claimsToSync, JSON-serializable. */
function buildSyncedClaims(
  claims: Record<string, unknown>,
  claimsToSync: string[]
): Record<string, unknown> | null {
  if (!Array.isArray(claimsToSync) || claimsToSync.length === 0) return null;
  const out: Record<string, unknown> = {};
  for (const key of claimsToSync) {
    const k = typeof key === 'string' ? key.trim() : '';
    if (!k || claims[k] === undefined) continue;
    out[k] = claims[k];
  }
  if (Object.keys(out).length === 0) return null;
  try {
    JSON.stringify(out);
  } catch {
    return null;
  }
  return out;
}

async function findOrCreateSeerrUserFromOidc(
  oidcSub: string,
  oidcIssuer: string,
  email: string,
  name: string | null,
  permissionsFromGroups: number | null,
  oidcClaims: Record<string, unknown> | null
): Promise<User> {
  const userRepository = getRepository(User);
  const settings = getSettings();
  const normalizedEmail = email?.toLowerCase() ?? '';

  let user = await userRepository.findOne({
    where: { oidcSub, oidcIssuer },
  });
  if (user) {
    let changed = false;
    if (
      permissionsFromGroups !== null &&
      user.permissions !== permissionsFromGroups
    ) {
      user.permissions = permissionsFromGroups;
      changed = true;
    }
    if (oidcClaims !== null) {
      user.oidcClaims = oidcClaims;
      changed = true;
    }
    if (normalizedEmail && user.email !== normalizedEmail) {
      user.email = normalizedEmail;
      changed = true;
    }
    if (name && user.username !== name) {
      user.username = name;
      changed = true;
    }
    if (changed) await userRepository.save(user);
    // Auto-link to Jellyfin on subsequent logins if not yet linked
    if (!user.jellyfinUserId) {
      await autoLinkJellyfinUser(user);
      // Reload to get updated fields
      user = (await userRepository.findOne({ where: { id: user.id } }))!;
    }
    return user;
  }

  if (normalizedEmail) {
    user = await userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (user) {
      user.oidcSub = oidcSub;
      user.oidcIssuer = oidcIssuer;
      user.userType = UserType.OIDC;
      if (name) user.username = name;
      if (permissionsFromGroups !== null)
        user.permissions = permissionsFromGroups;
      if (oidcClaims !== null) user.oidcClaims = oidcClaims;
      await userRepository.save(user);
      // Auto-link to Jellyfin if not yet linked
      if (!user.jellyfinUserId) {
        await autoLinkJellyfinUser(user);
        user = (await userRepository.findOne({ where: { id: user.id } }))!;
      }
      return user;
    }
  }

  const isFirstUser = (await userRepository.count()) === 0;
  const permissions =
    permissionsFromGroups !== null
      ? permissionsFromGroups
      : isFirstUser
        ? Permission.ADMIN
        : settings.main.defaultPermissions;
  const newUser = new User({
    email: normalizedEmail || `oidc-${oidcSub}@placeholder.local`,
    userType: UserType.OIDC,
    permissions,
    avatar: gravatarUrl(normalizedEmail || 'none', {
      default: 'mm',
      size: 200,
    }),
    oidcSub,
    oidcIssuer,
    username: name ?? undefined,
    oidcClaims: oidcClaims ?? undefined,
  });
  await userRepository.save(newUser);

  // Auto-link to Jellyfin user
  await autoLinkJellyfinUser(newUser);

  return newUser;
}

async function autoLinkJellyfinUser(user: User): Promise<void> {
  if (user.jellyfinUserId) return; // already linked

  const settings = getSettings();
  if (
    settings.main.mediaServerType !== MediaServerType.JELLYFIN &&
    settings.main.mediaServerType !== MediaServerType.EMBY
  ) {
    return;
  }

  try {
    const userRepository = getRepository(User);
    const admin = await userRepository.findOne({
      where: { id: 1 },
      select: ['id', 'jellyfinDeviceId', 'jellyfinUserId'],
    });

    const deviceId = admin?.jellyfinDeviceId || 'BOT_seerr';
    const jellyfinClient = new JellyfinAPI(
      getHostname(),
      settings.jellyfin.apiKey,
      deviceId
    );

    const { users: jellyfinUsers } = await jellyfinClient.getUsers();
    const normalizedEmail = user.email?.toLowerCase() ?? '';
    const normalizedUsername = user.username?.toLowerCase() ?? '';

    const matchedJfUser = jellyfinUsers.find((jfUser) => {
      const jfName = jfUser.Name?.toLowerCase() ?? '';
      return (
        (normalizedEmail && jfName === normalizedEmail) ||
        (normalizedUsername && jfName === normalizedUsername)
      );
    });

    if (matchedJfUser) {
      user.jellyfinUserId = matchedJfUser.Id;
      user.jellyfinUsername = matchedJfUser.Name;
      if (
        !user.userType ||
        user.userType === UserType.OIDC
      ) {
        user.userType =
          settings.main.mediaServerType === MediaServerType.JELLYFIN
            ? UserType.JELLYFIN
            : UserType.EMBY;
      }
      await userRepository.save(user);
      logger.info(
        `Auto-linked OIDC user "${user.email}" to Jellyfin user "${matchedJfUser.Name}" (${matchedJfUser.Id})`,
        { label: 'Auth' }
      );
    } else {
      logger.debug(
        `No matching Jellyfin user found for OIDC user "${user.email}"`,
        { label: 'Auth' }
      );
    }
  } catch (e) {
    logger.warn(
      `Failed to auto-link OIDC user to Jellyfin: ${(e as Error).message}`,
      { label: 'Auth' }
    );
  }
}

authRoutes.get('/oidc', async (req, res) => {
  const settings = getSettings();
  const oidcSettings = settings.oidc;
  if (
    !oidcSettings?.clientId?.trim() ||
    (!oidcSettings.useDiscovery && !oidcSettings.authorizationUrl?.trim())
  ) {
    return res.redirect(LOGIN_ERROR_REDIRECT);
  }
  const baseUrl = settings.main?.applicationUrl?.trim() || '';
  const applicationUrl =
    baseUrl || `${req.protocol}://${req.get('host') ?? ''}`;
  const redirectUri = `${applicationUrl.replace(/\/?$/, '')}/api/v1/auth/oidc/sync`;
  try {
    const pending = createOidcPending();
    if (req.session) {
      req.session.oidcPending = pending;
    }
    const url = await getAuthorizationUrl(oidcSettings, redirectUri, pending);
    const issuerOrigin = getOidcIssuerOrigin(oidcSettings);
    if (issuerOrigin && url.origin !== issuerOrigin) {
      logger.warn('OIDC redirect rejected: URL origin not in allowlist', {
        label: 'Auth',
        urlOrigin: url.origin,
        expectedOrigin: issuerOrigin,
      });
      return res.redirect(LOGIN_ERROR_REDIRECT);
    }
    // Redirect target validated above: url.origin must match configured OIDC issuer (allowlist)
    return res.redirect(url.toString());
  } catch (e) {
    logger.warn('OIDC redirect failed', {
      label: 'Auth',
      message: (e as Error).message,
    });
    return res.redirect(LOGIN_ERROR_REDIRECT);
  }
});

authRoutes.get('/oidc/sync', async (req, res) => {
  const settings = getSettings();
  const oidcSettings = settings.oidc;
  const pending = req.session?.oidcPending;
  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state =
    typeof req.query.state === 'string' ? req.query.state : undefined;
  if (!oidcSettings?.clientId?.trim() || !pending || !code || !state) {
    if (req.session) delete req.session.oidcPending;
    return res.redirect(LOGIN_ERROR_REDIRECT);
  }
  const baseUrl = settings.main?.applicationUrl?.trim() || '';
  const applicationUrl =
    baseUrl || `${req.protocol}://${req.get('host') ?? ''}`;
  const redirectUri = `${applicationUrl.replace(/\/?$/, '')}/api/v1/auth/oidc/sync`;
  try {
    const callbackUrl = new URL(req.originalUrl, applicationUrl);
    const result = await handleCallback(
      oidcSettings,
      redirectUri,
      callbackUrl,
      pending
    );
    if (req.session) delete req.session.oidcPending;

    const groupsClaim = oidcSettings?.groupsClaim?.trim() || 'groups';
    const nameClaim = oidcSettings?.nameClaim?.trim() || 'name';
    const emailClaim = oidcSettings?.emailClaim?.trim() || 'email';
    const groupMappings = Array.isArray(oidcSettings?.groupMappings)
      ? oidcSettings.groupMappings
      : [];
    const claimsToSync = Array.isArray(oidcSettings?.claimsToSync)
      ? oidcSettings.claimsToSync.filter(
          (c): c is string => typeof c === 'string'
        )
      : [];

    const email =
      (result.claims[emailClaim] as string) ??
      (result.claims.email as string) ??
      '';
    const name: string | null =
      (result.claims[nameClaim] as string) ??
      (result.claims.name as string) ??
      null;
    const groups = groupsFromClaims(
      result.claims as Record<string, unknown>,
      groupsClaim
    );
    const permissionsFromGroups =
      groups.length || groupMappings.length
        ? computePermissionsFromGroups(
            groups,
            groupMappings,
            settings.main.defaultPermissions
          )
        : null;
    const oidcClaims = buildSyncedClaims(
      result.claims as Record<string, unknown>,
      claimsToSync
    );

    const oidcIssuer =
      oidcSettings.useDiscovery && oidcSettings.issuerUrl?.trim()
        ? oidcSettings.issuerUrl.replace(/\/?$/, '')
        : (oidcSettings.issuer?.trim() ?? '');

    const user = await findOrCreateSeerrUserFromOidc(
      result.sub,
      oidcIssuer,
      email,
      name,
      permissionsFromGroups,
      oidcClaims
    );

    const oidcAccountRepo = getRepository(OidcAccount);
    const expiresAt = result.expiresIn
      ? new Date(Date.now() + result.expiresIn * 1000)
      : null;
    let account = await oidcAccountRepo.findOne({
      where: { userId: user.id, issuer: oidcIssuer, sub: result.sub },
    });
    if (account) {
      account.accessToken = result.accessToken ?? null;
      account.refreshToken = result.refreshToken ?? null;
      account.idToken = result.idToken ?? null;
      account.accessTokenExpiresAt = expiresAt;
      account.updatedAt = new Date();
      await oidcAccountRepo.save(account);
    } else {
      account = oidcAccountRepo.create({
        userId: user.id,
        issuer: oidcIssuer,
        sub: result.sub,
        accessToken: result.accessToken ?? null,
        refreshToken: result.refreshToken ?? null,
        idToken: result.idToken ?? null,
        accessTokenExpiresAt: expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await oidcAccountRepo.save(account);
    }

    if (req.session) {
      req.session.userId = user.id;
    }
    const redirectTo = baseUrl ? `${baseUrl.replace(/\/?$/, '')}/` : '/';
    return res.redirect(redirectTo);
  } catch (e) {
    logger.warn('OIDC sync failed', {
      label: 'Auth',
      message: (e as Error).message,
    });
    if (req.session) delete req.session.oidcPending;
    return res.redirect(LOGIN_ERROR_REDIRECT);
  }
});

authRoutes.get('/accounts', isAuthenticated(), async (req, res) => {
  if (!req.user?.id) {
    return res.status(200).json({ accounts: [] });
  }
  const oidcAccountRepo = getRepository(OidcAccount);
  const list = await oidcAccountRepo.find({
    where: { userId: req.user.id },
    select: { id: true, issuer: true, sub: true, createdAt: true },
  });
  const accounts = list.map((a) => ({
    id: a.id,
    providerId: 'oidc',
    accountId: a.sub,
    createdAt: a.createdAt,
  }));
  return res.status(200).json({ accounts });
});

authRoutes.get('/me', isAuthenticated(), async (req, res) => {
  const userRepository = getRepository(User);
  if (!req.user) {
    return res.status(500).json({
      status: 500,
      error: 'Please sign in.',
    });
  }
  const user = await userRepository.findOneOrFail({
    where: { id: req.user.id },
  });

  // check if email is required in settings and if user has an valid email
  const settings = await getSettings();
  if (
    settings.notifications.agents.email.options.userEmailRequired &&
    !validator.isEmail(user.email, { require_tld: false })
  ) {
    user.warnings.push('userEmailRequired');
    logger.warn(`User ${user.username} has no valid email address`);
  }

  return res.status(200).json(user);
});

authRoutes.post('/plex', async (req, res, next) => {
  const settings = getSettings();
  const userRepository = getRepository(User);
  const body = req.body as { authToken?: string };

  if (!body.authToken) {
    return next({
      status: 500,
      message: 'Authentication token required.',
    });
  }

  if (
    settings.main.mediaServerType != MediaServerType.NOT_CONFIGURED &&
    (settings.main.mediaServerLogin === false ||
      settings.main.mediaServerType != MediaServerType.PLEX)
  ) {
    return res.status(500).json({ error: 'Plex login is disabled' });
  }
  try {
    // First we need to use this auth token to get the user's email from plex.tv
    const plextv = new PlexTvAPI(body.authToken);
    const account = await plextv.getUser();

    // Next let's see if the user already exists
    let user = await userRepository
      .createQueryBuilder('user')
      .where('user.plexId = :id', { id: account.id })
      .orWhere('user.email = :email', {
        email: account.email.toLowerCase(),
      })
      .getOne();

    if (!user && !(await userRepository.count())) {
      user = new User({
        email: account.email,
        plexUsername: account.username,
        plexId: account.id,
        plexToken: account.authToken,
        permissions: Permission.ADMIN,
        avatar: account.thumb,
        userType: UserType.PLEX,
      });

      settings.main.mediaServerType = MediaServerType.PLEX;
      await settings.save();
      startJobs();

      await userRepository.save(user);
    } else {
      const mainUser = await userRepository.findOneOrFail({
        select: { id: true, plexToken: true, plexId: true, email: true },
        where: { id: 1 },
      });
      const mainPlexTv = new PlexTvAPI(mainUser.plexToken ?? '');

      if (!account.id) {
        logger.error('Plex ID was missing from Plex.tv response', {
          label: 'API',
          ip: req.ip,
          email: account.email,
          plexUsername: account.username,
        });

        return next({
          status: 500,
          message: 'Something went wrong. Try again.',
        });
      }

      if (
        account.id === mainUser.plexId ||
        (account.email === mainUser.email && !mainUser.plexId) ||
        (await mainPlexTv.checkUserAccess(account.id))
      ) {
        if (user) {
          if (!user.plexId) {
            logger.info(
              'Found matching Plex user; updating user with Plex data',
              {
                label: 'API',
                ip: req.ip,
                email: user.email,
                userId: user.id,
                plexId: account.id,
                plexUsername: account.username,
              }
            );
          }

          user.plexToken = body.authToken;
          user.plexId = account.id;
          user.avatar = account.thumb;
          user.email = account.email;
          user.plexUsername = account.username;
          user.userType = UserType.PLEX;

          await userRepository.save(user);
        } else if (!settings.main.newPlexLogin) {
          logger.warn(
            'Failed sign-in attempt by unimported Plex user with access to the media server',
            {
              label: 'API',
              ip: req.ip,
              email: account.email,
              plexId: account.id,
              plexUsername: account.username,
            }
          );
          return next({
            status: 403,
            message: 'Access denied.',
          });
        } else {
          logger.info(
            'Sign-in attempt from Plex user with access to the media server; creating new Seerr user',
            {
              label: 'API',
              ip: req.ip,
              email: account.email,
              plexId: account.id,
              plexUsername: account.username,
            }
          );
          user = new User({
            email: account.email,
            plexUsername: account.username,
            plexId: account.id,
            plexToken: account.authToken,
            permissions: settings.main.defaultPermissions,
            avatar: account.thumb,
            userType: UserType.PLEX,
          });

          await userRepository.save(user);
        }
      } else {
        logger.warn(
          'Failed sign-in attempt by Plex user without access to the media server',
          {
            label: 'API',
            ip: req.ip,
            email: account.email,
            plexId: account.id,
            plexUsername: account.username,
          }
        );
        return next({
          status: 403,
          message: 'Access denied.',
        });
      }
    }

    // Set logged in session
    if (req.session) {
      req.session.userId = user.id;
    }

    return res.status(200).json(user?.filter() ?? {});
  } catch (e) {
    logger.error('Something went wrong authenticating with Plex account', {
      label: 'API',
      errorMessage: e.message,
      ip: req.ip,
    });
    return next({
      status: 500,
      message: 'Unable to authenticate.',
    });
  }
});

function getUserAvatarUrl(user: User): string {
  return `/avatarproxy/${user.jellyfinUserId}?v=${user.avatarVersion}`;
}

authRoutes.post('/jellyfin', async (req, res, next) => {
  const settings = getSettings();
  const userRepository = getRepository(User);
  const body = req.body as {
    username?: string;
    password?: string;
    hostname?: string;
    port?: number;
    urlBase?: string;
    useSsl?: boolean;
    email?: string;
    serverType?: number;
  };

  //Make sure jellyfin login is enabled, but only if jellyfin && Emby is not already configured
  if (
    // media server not configured, allow login for setup
    settings.main.mediaServerType != MediaServerType.NOT_CONFIGURED &&
    (settings.main.mediaServerLogin === false ||
      // media server is neither jellyfin or emby
      (settings.main.mediaServerType !== MediaServerType.JELLYFIN &&
        settings.main.mediaServerType !== MediaServerType.EMBY &&
        settings.jellyfin.ip !== ''))
  ) {
    return res.status(500).json({ error: 'Jellyfin login is disabled' });
  }

  if (!body.username) {
    return res.status(500).json({ error: 'You must provide an username' });
  } else if (settings.jellyfin.ip !== '' && body.hostname) {
    return res
      .status(500)
      .json({ error: 'Jellyfin hostname already configured' });
  } else if (settings.jellyfin.ip === '' && !body.hostname) {
    return res.status(500).json({ error: 'No hostname provided.' });
  }

  try {
    const hostname =
      settings.jellyfin.ip !== ''
        ? getHostname()
        : getHostname({
            useSsl: body.useSsl,
            ip: body.hostname,
            port: body.port,
            urlBase: body.urlBase,
          });

    // Try to find deviceId that corresponds to jellyfin user, else generate a new one
    let user = await userRepository.findOne({
      where: { jellyfinUsername: body.username },
      select: { id: true, jellyfinDeviceId: true },
    });

    let deviceId = 'BOT_seerr';
    if (user && user.id === 1) {
      // Admin is always BOT_seerr
      deviceId = 'BOT_seerr';
    } else if (user && user.jellyfinDeviceId) {
      deviceId = user.jellyfinDeviceId;
    } else if (body.username) {
      deviceId = Buffer.from(`BOT_seerr_${body.username}`).toString('base64');
    }

    // First we need to attempt to log the user in to jellyfin
    const jellyfinserver = new JellyfinAPI(hostname ?? '', undefined, deviceId);

    const ip = req.ip;
    let clientIp;

    if (ip) {
      if (net.isIPv4(ip)) {
        clientIp = ip;
      } else if (net.isIPv6(ip)) {
        clientIp = ip.startsWith('::ffff:') ? ip.substring(7) : ip;
      }
    }

    const account = await jellyfinserver.login(
      body.username,
      body.password,
      clientIp
    );

    // Next let's see if the user already exists
    user = await userRepository.findOne({
      where: { jellyfinUserId: account.User.Id },
    });

    const missingAdminUser = !user && !(await userRepository.count());
    if (
      missingAdminUser ||
      settings.main.mediaServerType === MediaServerType.NOT_CONFIGURED
    ) {
      // Check if user is admin on jellyfin
      if (account.User.Policy.IsAdministrator === false) {
        throw new ApiError(403, ApiErrorCode.NotAdmin);
      }

      if (
        body.serverType !== MediaServerType.JELLYFIN &&
        body.serverType !== MediaServerType.EMBY
      ) {
        throw new ApiError(500, ApiErrorCode.NoAdminUser);
      }
      settings.main.mediaServerType = body.serverType;

      if (missingAdminUser) {
        logger.info(
          'Sign-in attempt from Jellyfin user with access to the media server; creating initial admin user for Seerr',
          {
            label: 'API',
            ip: req.ip,
            jellyfinUsername: account.User.Name,
          }
        );

        // User doesn't exist, and there are no users in the database, we'll create the user
        // with admin permissions

        user = new User({
          id: 1,
          email: body.email || account.User.Name,
          jellyfinUsername: account.User.Name,
          jellyfinUserId: account.User.Id,
          jellyfinDeviceId: deviceId,
          jellyfinAuthToken: account.AccessToken,
          permissions: Permission.ADMIN,
          userType:
            body.serverType === MediaServerType.JELLYFIN
              ? UserType.JELLYFIN
              : UserType.EMBY,
        });
        user.avatar = getUserAvatarUrl(user);

        await userRepository.save(user);
      } else {
        logger.info(
          'Sign-in attempt from Jellyfin user with access to the media server; editing admin user for Seerr',
          {
            label: 'API',
            ip: req.ip,
            jellyfinUsername: account.User.Name,
          }
        );

        // User alread exist but settings.json is not configured, we'll edit the admin user

        user = await userRepository.findOne({
          where: { id: 1 },
        });
        if (!user) {
          throw new Error('Unable to find admin user to edit');
        }
        user.email = body.email || account.User.Name;
        user.jellyfinUsername = account.User.Name;
        user.jellyfinUserId = account.User.Id;
        user.jellyfinDeviceId = deviceId;
        user.jellyfinAuthToken = account.AccessToken;
        user.permissions = Permission.ADMIN;
        user.avatar = getUserAvatarUrl(user);
        user.userType =
          body.serverType === MediaServerType.JELLYFIN
            ? UserType.JELLYFIN
            : UserType.EMBY;

        await userRepository.save(user);
      }

      // Create an API key on Jellyfin from this admin user
      const jellyfinClient = new JellyfinAPI(
        hostname,
        account.AccessToken,
        deviceId
      );
      const apiKey = await jellyfinClient.createApiToken('Seerr');

      const serverName = await jellyfinserver.getServerName();

      settings.jellyfin.name = serverName;
      settings.jellyfin.serverId = account.User.ServerId;
      settings.jellyfin.ip = body.hostname ?? '';
      settings.jellyfin.port = body.port ?? 8096;
      settings.jellyfin.urlBase = body.urlBase ?? '';
      settings.jellyfin.useSsl = body.useSsl ?? false;
      settings.jellyfin.apiKey = apiKey;
      await settings.save();
      startJobs();
    }
    // User already exists, let's update their information
    else if (account.User.Id === user?.jellyfinUserId) {
      logger.info(
        `Found matching ${
          settings.main.mediaServerType === MediaServerType.JELLYFIN
            ? ServerType.JELLYFIN
            : ServerType.EMBY
        } user; updating user with ${
          settings.main.mediaServerType === MediaServerType.JELLYFIN
            ? ServerType.JELLYFIN
            : ServerType.EMBY
        }`,
        {
          label: 'API',
          ip: req.ip,
          jellyfinUsername: account.User.Name,
        }
      );
      user.avatar = getUserAvatarUrl(user);
      user.jellyfinUsername = account.User.Name;

      if (user.username === account.User.Name) {
        user.username = '';
      }

      await userRepository.save(user);
    } else if (!settings.main.newPlexLogin) {
      logger.warn(
        'Failed sign-in attempt by unimported Jellyfin user with access to the media server',
        {
          label: 'API',
          ip: req.ip,
          jellyfinUserId: account.User.Id,
          jellyfinUsername: account.User.Name,
        }
      );
      return next({
        status: 403,
        message: 'Access denied.',
      });
    } else if (!user) {
      logger.info(
        'Sign-in attempt from Jellyfin user with access to the media server; creating new Seerr user',
        {
          label: 'API',
          ip: req.ip,
          jellyfinUsername: account.User.Name,
        }
      );

      user = new User({
        email: body.email,
        jellyfinUsername: account.User.Name,
        jellyfinUserId: account.User.Id,
        jellyfinDeviceId: deviceId,
        permissions: settings.main.defaultPermissions,
        userType:
          settings.main.mediaServerType === MediaServerType.JELLYFIN
            ? UserType.JELLYFIN
            : UserType.EMBY,
      });
      user.avatar = getUserAvatarUrl(user);

      //initialize Jellyfin/Emby users with local login
      const passedExplicitPassword = body.password && body.password.length > 0;
      if (passedExplicitPassword) {
        await user.setPassword(body.password ?? '');
      }
      await userRepository.save(user);
    }

    if (user && user.jellyfinUserId) {
      try {
        const { changed } = await checkAvatarChanged(user);

        if (changed) {
          user.avatar = getUserAvatarUrl(user);
          await userRepository.save(user);
          logger.debug('Avatar updated during login', {
            userId: user.id,
            jellyfinUserId: user.jellyfinUserId,
          });
        }
      } catch (error) {
        logger.error('Error handling avatar during login', {
          label: 'Auth',
          errorMessage: error.message,
        });
      }
    }

    // Set logged in session
    if (req.session) {
      req.session.userId = user?.id;
    }

    return res.status(200).json(user?.filter() ?? {});
  } catch (e) {
    switch (e.errorCode) {
      case ApiErrorCode.InvalidUrl:
        logger.error(
          `The provided ${
            settings.main.mediaServerType === MediaServerType.JELLYFIN
              ? ServerType.JELLYFIN
              : ServerType.EMBY
          } is invalid or the server is not reachable.`,
          {
            label: 'Auth',
            error: e.errorCode,
            status: e.statusCode,
            hostname: getHostname({
              useSsl: body.useSsl,
              ip: body.hostname,
              port: body.port,
              urlBase: body.urlBase,
            }),
          }
        );
        return next({
          status: e.statusCode,
          message: e.errorCode,
        });

      case ApiErrorCode.InvalidCredentials:
        logger.warn(
          'Failed login attempt from user with incorrect Jellyfin credentials',
          {
            label: 'Auth',
            account: {
              ip: req.ip,
              email: body.username,
              password: '__REDACTED__',
            },
          }
        );
        return next({
          status: e.statusCode,
          message: e.errorCode,
        });

      case ApiErrorCode.NotAdmin:
        logger.warn(
          'Failed login attempt from user without admin permissions',
          {
            label: 'Auth',
            account: {
              ip: req.ip,
              email: body.username,
            },
          }
        );
        return next({
          status: e.statusCode,
          message: e.errorCode,
        });

      case ApiErrorCode.NoAdminUser:
        logger.warn(
          'Failed login attempt from user without admin permissions and no admin user exists',
          {
            label: 'Auth',
            account: {
              ip: req.ip,
              email: body.username,
            },
          }
        );
        return next({
          status: e.statusCode,
          message: e.errorCode,
        });

      default:
        logger.error(e.message, { label: 'Auth' });
        return next({
          status: 500,
          message: 'Something went wrong.',
        });
    }
  }
});

authRoutes.post('/local', async (req, res, next) => {
  const settings = getSettings();
  const userRepository = getRepository(User);
  const body = req.body as { email?: string; password?: string };

  if (!settings.main.localLogin) {
    return res.status(500).json({ error: 'Password sign-in is disabled.' });
  } else if (!body.email || !body.password) {
    return res.status(500).json({
      error: 'You must provide both an email address and a password.',
    });
  }
  try {
    const user = await userRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.email', 'user.password', 'user.plexId'])
      .where('user.email = :email', { email: body.email.toLowerCase() })
      .getOne();

    if (!user || !(await user.passwordMatch(body.password))) {
      logger.warn('Failed sign-in attempt using invalid Seerr password', {
        label: 'API',
        ip: req.ip,
        email: body.email,
        userId: user?.id,
      });
      return next({
        status: 403,
        message: 'Access denied.',
      });
    }

    // Set logged in session
    if (user && req.session) {
      req.session.userId = user.id;
    }

    return res.status(200).json(user?.filter() ?? {});
  } catch (e) {
    logger.error('Something went wrong authenticating with Seerr password', {
      label: 'API',
      errorMessage: e.message,
      ip: req.ip,
      email: body.email,
    });
    return next({
      status: 500,
      message: 'Unable to authenticate.',
    });
  }
});

authRoutes.post('/logout', async (req, res, next) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(200).json({ status: 'ok' });
    }

    const settings = getSettings();
    const isJellyfinOrEmby =
      settings.main.mediaServerType === MediaServerType.JELLYFIN ||
      settings.main.mediaServerType === MediaServerType.EMBY;

    if (isJellyfinOrEmby) {
      const user = await getRepository(User)
        .createQueryBuilder('user')
        .addSelect(['user.jellyfinUserId', 'user.jellyfinDeviceId'])
        .where('user.id = :id', { id: userId })
        .getOne();

      if (user?.jellyfinUserId && user.jellyfinDeviceId) {
        try {
          const baseUrl = getHostname();
          try {
            await axios.delete(`${baseUrl}/Devices`, {
              params: { Id: user.jellyfinDeviceId },
              headers: {
                'X-Emby-Authorization': `MediaBrowser Client="Seerr", Device="Seerr", DeviceId="seerr", Version="${getAppVersion()}", Token="${
                  settings.jellyfin.apiKey
                }"`,
              },
            });
          } catch (error) {
            logger.error('Failed to delete Jellyfin device', {
              label: 'Auth',
              error: error instanceof Error ? error.message : 'Unknown error',
              userId: user.id,
              jellyfinUserId: user.jellyfinUserId,
            });
          }
        } catch (error) {
          logger.error('Failed to delete Jellyfin device', {
            label: 'Auth',
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: user.id,
            jellyfinUserId: user.jellyfinUserId,
          });
        }
      }
    }

    req.session?.destroy((err: Error | null) => {
      if (err) {
        logger.error('Failed to destroy session', {
          label: 'Auth',
          error: err.message,
          userId,
        });
        return next({ status: 500, message: 'Failed to destroy session.' });
      }
      logger.debug('Successfully logged out user', {
        label: 'Auth',
        userId,
      });
      res.status(200).json({ status: 'ok' });
    });
  } catch (error) {
    logger.error('Error during logout process', {
      label: 'Auth',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.session?.userId,
    });
    next({ status: 500, message: 'Error during logout process.' });
  }
});

authRoutes.post('/reset-password', async (req, res, next) => {
  const userRepository = getRepository(User);
  const body = req.body as { email?: string };

  if (!body.email) {
    return next({
      status: 500,
      message: 'Email address required.',
    });
  }

  const user = await userRepository
    .createQueryBuilder('user')
    .where('user.email = :email', { email: body.email.toLowerCase() })
    .getOne();

  if (user) {
    await user.resetPassword();
    userRepository.save(user);
    logger.info('Successfully sent password reset link', {
      label: 'API',
      ip: req.ip,
      email: body.email,
    });
  } else {
    logger.error('Something went wrong sending password reset link', {
      label: 'API',
      ip: req.ip,
      email: body.email,
    });
  }

  return res.status(200).json({ status: 'ok' });
});

authRoutes.post('/reset-password/:guid', async (req, res, next) => {
  const userRepository = getRepository(User);

  if (!req.body.password || req.body.password?.length < 8) {
    logger.warn('Failed password reset attempt using invalid new password', {
      label: 'API',
      ip: req.ip,
      guid: req.params.guid,
    });
    return next({
      status: 500,
      message: 'Password must be at least 8 characters long.',
    });
  }

  const user = await userRepository.findOne({
    where: { resetPasswordGuid: req.params.guid },
  });

  if (!user) {
    logger.warn('Failed password reset attempt using invalid recovery link', {
      label: 'API',
      ip: req.ip,
      guid: req.params.guid,
    });
    return next({
      status: 500,
      message: 'Invalid password reset link.',
    });
  }

  if (
    !user.recoveryLinkExpirationDate ||
    user.recoveryLinkExpirationDate <= new Date()
  ) {
    logger.warn('Failed password reset attempt using expired recovery link', {
      label: 'API',
      ip: req.ip,
      guid: req.params.guid,
      email: user.email,
    });
    return next({
      status: 500,
      message: 'Invalid password reset link.',
    });
  }
  user.recoveryLinkExpirationDate = null;
  await user.setPassword(req.body.password);
  userRepository.save(user);
  logger.info('Successfully reset password', {
    label: 'API',
    ip: req.ip,
    guid: req.params.guid,
    email: user.email,
  });

  return res.status(200).json({ status: 'ok' });
});

export default authRoutes;

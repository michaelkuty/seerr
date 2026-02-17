/**
 * OIDC client using openid-client (panva).
 * Aligns with NIST SP 800-63B, OWASP ASVS, RFC 8725.
 * Uses Authorization Code flow with PKCE only.
 */

import type { OidcSettings } from '@server/lib/settings';
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  ClientSecretPost,
  Configuration,
  discovery,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
} from 'openid-client';

const DEFAULT_SCOPES = 'openid profile email';

export interface OidcPending {
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface OidcCallbackResult {
  sub: string;
  idToken: string | undefined;
  accessToken: string | undefined;
  refreshToken: string | undefined;
  expiresIn: number | undefined;
  claims: Record<string, unknown>;
}

let configCache: Configuration | null = null;
let configCacheKey: string | null = null;

function cacheKey(oidc: OidcSettings): string {
  return [
    oidc.issuerUrl,
    oidc.useDiscovery ? '1' : '0',
    oidc.clientId,
    oidc.authorizationUrl,
    oidc.tokenUrl,
  ].join('|');
}

/**
 * Get or create openid-client Configuration (discovery or manual).
 * Cached per settings fingerprint.
 */
export async function getOidcConfig(
  oidc: OidcSettings,
  redirectUri: string
): Promise<Configuration> {
  const key = cacheKey(oidc);
  if (configCache && configCacheKey === key) {
    return configCache;
  }

  const clientId = oidc.clientId?.trim() ?? '';
  const clientSecret = (oidc.clientSecret?.trim() ?? '') || undefined;
  const clientAuth = clientSecret ? ClientSecretPost(clientSecret) : undefined;

  const metadata = {
    redirect_uris: [redirectUri],
    response_type: 'code',
    scope: (oidc.scopes?.length
      ? oidc.scopes.join(' ')
      : DEFAULT_SCOPES
    ).trim(),
  };

  if (oidc.useDiscovery && oidc.issuerUrl?.trim()) {
    const issuerUrl = oidc.issuerUrl.replace(/\/?$/, '');
    const server = new URL(
      issuerUrl.startsWith('http') ? issuerUrl : `https://${issuerUrl}`
    );
    configCache = await discovery(server, clientId, metadata, clientAuth);
  } else {
    const issuer = oidc.issuer?.trim() || 'https://placeholder';
    const authUrl = oidc.authorizationUrl?.trim();
    const tokenUrl = oidc.tokenUrl?.trim();
    if (!authUrl || !tokenUrl) {
      throw new Error('Manual OIDC requires authorizationUrl and tokenUrl');
    }
    const server = {
      issuer,
      authorization_endpoint: authUrl,
      token_endpoint: tokenUrl,
    };
    configCache = new Configuration(server, clientId, metadata, clientAuth);
  }

  configCacheKey = key;
  return configCache;
}

/**
 * Generate PKCE verifier, state, and nonce (CSPRNG via openid-client).
 */
export function createOidcPending(): OidcPending {
  return {
    state: randomState(),
    nonce: randomNonce(),
    codeVerifier: randomPKCECodeVerifier(),
  };
}

/**
 * Build authorization URL with PKCE (S256) and state/nonce.
 * RFC 7636; NIST/OWASP recommend PKCE for public/code flows.
 */
export async function getAuthorizationUrl(
  oidc: OidcSettings,
  redirectUri: string,
  pending: OidcPending
): Promise<URL> {
  const config = await getOidcConfig(oidc, redirectUri);
  const scope = (
    oidc.scopes?.length ? oidc.scopes.join(' ') : DEFAULT_SCOPES
  ).trim();
  const codeChallenge = await calculatePKCECodeChallenge(pending.codeVerifier);
  return buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope,
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
}

/**
 * Exchange code for tokens and validate ID token (iss, aud, exp, nbf, nonce).
 * openid-client enforces RFC 8725 JWT validation.
 */
export async function handleCallback(
  oidc: OidcSettings,
  redirectUri: string,
  callbackUrl: URL,
  pending: OidcPending
): Promise<OidcCallbackResult> {
  const config = await getOidcConfig(oidc, redirectUri);
  const tokenSet = await authorizationCodeGrant(config, callbackUrl, {
    expectedState: pending.state,
    expectedNonce: pending.nonce,
    pkceCodeVerifier: pending.codeVerifier,
  });

  const helpers = tokenSet as {
    claims?: () => Record<string, unknown> | undefined;
  };
  const claims = helpers.claims?.() ?? {};
  const sub = (claims.sub as string) ?? '';

  return {
    sub,
    idToken: tokenSet.id_token,
    accessToken: tokenSet.access_token,
    refreshToken: tokenSet.refresh_token,
    expiresIn: tokenSet.expires_in,
    claims: claims ?? {},
  };
}

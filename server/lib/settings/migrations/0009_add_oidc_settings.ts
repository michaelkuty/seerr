import type { AllSettings } from '@server/lib/settings';

const migrateOidcSettings = (settings: AllSettings): AllSettings => {
  const next = { ...settings };

  if (
    next.main &&
    typeof (next.main as unknown as Record<string, unknown>).oidcLogin ===
      'undefined'
  ) {
    next.main = {
      ...next.main,
      oidcLogin: false,
    };
  }

  if (!next.oidc) {
    next.oidc = {
      issuerUrl: '',
      useDiscovery: true,
      authorizationUrl: '',
      tokenUrl: '',
      userInfoUrl: '',
      issuer: '',
      clientId: '',
      clientSecret: '',
      displayName: 'SSO',
      groupsClaim: 'groups',
      nameClaim: 'name',
      emailClaim: 'email',
      groupMappings: [],
      claimsToSync: [],
      scopes: ['openid', 'profile', 'email'],
    };
  } else {
    const o = next.oidc as unknown as Record<string, unknown>;
    if (o.useDiscovery === undefined) o.useDiscovery = true;
    if (o.authorizationUrl === undefined) o.authorizationUrl = '';
    if (o.tokenUrl === undefined) o.tokenUrl = '';
    if (o.userInfoUrl === undefined) o.userInfoUrl = '';
    if (o.issuer === undefined) o.issuer = '';
    if (o.groupsClaim === undefined) o.groupsClaim = 'groups';
    if (o.nameClaim === undefined) o.nameClaim = 'name';
    if (o.emailClaim === undefined) o.emailClaim = 'email';
    if (!Array.isArray(o.groupMappings)) o.groupMappings = [];
    if (!Array.isArray(o.claimsToSync)) o.claimsToSync = [];
    if (!Array.isArray(o.scopes)) o.scopes = ['openid', 'profile', 'email'];
  }

  return next;
};

export default migrateOidcSettings;

import 'express-session';

// Declaration merging to apply our own types to SessionData
// See: (https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/express-session/index.d.ts#L23)
declare module 'express-session' {
  interface SessionData {
    userId: number;
    /** OIDC state/nonce/code_verifier for callback (Authorization Code + PKCE). */
    oidcPending?: { state: string; nonce: string; codeVerifier: string };
  }
}

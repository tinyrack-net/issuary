/**
 * Test fixtures and constants used across all E2E test files.
 * These values match the backend config.yaml test data.
 */

/**
 * Test user credentials (exists in config.yaml)
 */
export const TEST_USER = {
  email: 'test-config-user@example.com',
  password: 'changemelater',
} as const;

/**
 * OAuth client configuration for testing
 * NOTE: These values must match the backend config.yaml providers section
 */
export const TEST_OAUTH_CLIENT = {
  clientId: 'sdlk3n3dkj2',
  clientSecret: 'sdlk3n3dkj2',
  redirectUri: 'http://localhost:3000/api/callback',
  allowedScopes: ['openid', 'profile', 'email'],
} as const;

/**
 * PKCE test vectors (RFC 7636 compliant)
 */
export const TEST_PKCE = {
  codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  codeChallengeMethod: 'S256' as const,
  codeVerifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
} as const;

/**
 * Default OAuth scopes for testing
 */
export const DEFAULT_SCOPES = 'openid profile email';

/**
 * Generate unique email for testing
 */
export function generateUniqueEmail(prefix = 'test'): string {
  return `${prefix}${Date.now()}@example.com`;
}

/**
 * Application routes
 */
export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  profile: '/profile',
  forgotPassword: '/password/forgot',
  resetPassword: '/password/reset',
  verifyEmail: '/verify/email',
  verifyTotp: '/verify/totp',
  verifyPasskey: '/verify/passkey',
  verify2fa: '/verify/2fa',
  setupTotp: '/setup/totp',
  setupPasskey: '/setup/passkey',
  setup2fa: '/setup/2fa',
  consent: '/consent',
  error: '/error',
} as const;

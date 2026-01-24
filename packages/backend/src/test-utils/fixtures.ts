/**
 * Test fixtures and constants used across all test files.
 * Provides reusable test data for OAuth clients, users, and PKCE.
 */

/**
 * OAuth client configuration for testing
 */
export const TEST_OAUTH_CLIENT = {
  clientId: 'sdlk3n3dkj2',
  clientSecret: 'sdlk3n3dkj2',
  redirectUri: 'http://localhost:8080/callback',
  allowedScopes: ['openid', 'profile', 'email'],
} as const;

/**
 * Test user credentials (exists in config.yaml)
 */
export const TEST_USER = {
  email: 'test-config-user@example.com',
  password: 'changemelater',
} as const;

/**
 * PKCE test vectors (RFC 7636 compliant)
 * code_verifier: dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
 * code_challenge (S256): E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
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
 * Default terms consents for registration tests.
 * Matches the terms defined in DEFAULT_TEST_CONFIG.
 */
export const TEST_CONSENTS = [
  { termsId: 'tos', agreed: true },
  { termsId: 'privacy', agreed: true },
] as const;

/**
 * Generate unique email for testing
 */
export function generateUniqueEmail(prefix = 'test'): string {
  return `${prefix}${Date.now()}@example.com`;
}

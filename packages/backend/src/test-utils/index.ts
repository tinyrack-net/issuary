/**
 * Test utilities for backend tests.
 * Provides common setup, helpers, and fixtures for all test files.
 */

// CLI test utilities
export {
  CLI_TEST_CONFIG,
  countEntities,
  createEmailVerification,
  createJwtKey,
  createOAuthCode,
  createPasswordReset,
  createRevokedToken,
  createTestOAuthClient,
  createTestUser,
  getJwtKey,
} from './cli.ts';
// Type-safe test client
export { assertJsonBody } from './client.ts';
// Test fixtures and constants
export {
  DEFAULT_SCOPES,
  generateUniqueEmail,
  TEST_CONSENTS,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_TERMS_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
} from './fixtures.ts';
// Types
export type { ErrorDefinition } from './helpers.ts';
// Common helper functions
export {
  createAuthenticatedSession,
  createDbUserWithSession,
  createPasskeyForUser,
  enableTotpForUser,
  expectError,
  extractCookie,
  getLocationHeader,
  grantConsent,
  registerUser,
  withMikroContext,
} from './helpers.ts';
export type {
  AuthorizationCodeResult,
  ExchangeCodeParams,
  GetAccessTokenParams,
  GetAuthorizationCodeParams,
  IntrospectTokenParams,
  RefreshTokenParams,
  RevokeTokenParams,
} from './oauth.ts';
// OAuth-specific helpers
export {
  exchangeCodeForTokens,
  getAccessToken,
  getAuthorizationCode,
  getUserInfo,
  introspectToken,
  parseJwks,
  refreshAccessToken,
  revokeToken,
} from './oauth.ts';
export type {
  OAuthMockTokens,
  OAuthMockUserInfo,
  OAuthProviderFetchMockOptions,
} from './oauth-mock.ts';
export { mockOAuthProviderFetch } from './oauth-mock.ts';
export type { TestEmailMessage } from './setup.ts';
// Setup utilities
export {
  createTestApp,
  createTestEmailConfig,
  MINIMAL_TEST_CONFIG,
} from './setup.ts';

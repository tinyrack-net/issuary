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
} from './cli.js';
// Type-safe test client
export { assertJsonBody } from './client.js';
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
} from './fixtures.js';
// Types
export type { ErrorDefinition } from './helpers.js';
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
} from './helpers.js';
export type {
  AuthorizationCodeResult,
  ExchangeCodeParams,
  GetAccessTokenParams,
  GetAuthorizationCodeParams,
  IntrospectTokenParams,
  RefreshTokenParams,
  RevokeTokenParams,
} from './oauth.js';
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
} from './oauth.js';
// Setup utilities
export { MINIMAL_TEST_CONFIG } from './setup.js';

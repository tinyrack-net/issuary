/**
 * Test utilities for backend tests.
 * Provides common setup, helpers, and fixtures for all test files.
 */

// Test fixtures and constants
export {
  DEFAULT_SCOPES,
  generateUniqueEmail,
  TEST_OAUTH_CLIENT,
  TEST_PKCE,
  TEST_USER,
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
  expectErrorCode,
  extractCookie,
  extractSessionCookie,
  grantConsent,
  injectWithCookie,
  injectWithSession,
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
  expectLoginRedirect,
  expectRedirectError,
  getAccessToken,
  getAuthorizationCode,
  getUserInfo,
  introspectToken,
  parseRedirectLocation,
  refreshAccessToken,
  revokeToken,
} from './oauth.js';
// Setup utilities
export { setupTestServer } from './setup.js';

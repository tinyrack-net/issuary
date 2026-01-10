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
// Common helper functions
export {
  createAuthenticatedSession,
  extractCookie,
  extractSessionCookie,
  injectWithCookie,
  injectWithSession,
  withMikroContext,
} from './helpers.js';
// Types
export type {
  AuthorizationCodeResult,
  ExchangeCodeParams,
  GetAccessTokenParams,
  GetAuthorizationCodeParams,
  RefreshTokenParams,
} from './oauth.js';

// OAuth-specific helpers
export {
  exchangeCodeForTokens,
  getAccessToken,
  getAuthorizationCode,
  getUserInfo,
  refreshAccessToken,
} from './oauth.js';
// Setup utilities
export { setupTestServer } from './setup.js';

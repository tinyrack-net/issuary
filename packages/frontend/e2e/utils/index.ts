/**
 * E2E Test Utilities
 *
 * This module exports all utility functions and classes for e2e testing.
 */

// API helpers
export {
  ApiHelpers,
  type AuthResponse,
  createApiHelpers,
  type LoginResponse,
  type RegisterResponse,
  type SessionUser,
  type TermsItem,
  type TermsResponse,
} from './api-helpers';
// Test user utilities
export {
  applySessionToPage,
  createTestUserManager,
  setupAuthenticatedUser,
  type TestUser,
  TestUserManager,
} from './test-user';
// WebAuthn mock
export {
  createWebAuthnMock,
  type VirtualAuthenticatorOptions,
  WebAuthnMock,
} from './webauthn-mock';

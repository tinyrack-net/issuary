/**
 * E2E Test Utilities
 *
 * This module exports all utility functions and classes for e2e testing.
 */

// API helpers
export {
  ApiHelpers,
  createApiHelpers,
  type SessionUser,
  type AuthResponse,
  type LoginResponse,
  type RegisterResponse,
} from './api-helpers';

// WebAuthn mock
export {
  WebAuthnMock,
  createWebAuthnMock,
  type VirtualAuthenticatorOptions,
} from './webauthn-mock';

// Test user utilities
export {
  TestUserManager,
  createTestUserManager,
  applySessionToPage,
  setupAuthenticatedUser,
  type TestUser,
} from './test-user';

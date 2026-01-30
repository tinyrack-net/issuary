/**
 * E2E Test Fixtures
 *
 * This module exports all custom fixtures for e2e testing.
 */

// Auth fixtures
export { type AuthFixtures, expect, type TestUser, test } from './auth.fixture';

// Test data utilities
export {
  generateEmail,
  generatePassword,
  generateWeakPassword,
  testData,
} from './test-data.fixture';

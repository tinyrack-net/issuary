/**
 * Test data generator utilities for e2e tests
 */

/**
 * Generates a unique email address for testing
 */
export function generateEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `test-${timestamp}-${random}@e2e.test`;
}

/**
 * Generates a valid test password
 */
export function generatePassword(): string {
  return 'TestPassword123!';
}

/**
 * Generates a weak password for validation testing
 */
export function generateWeakPassword(): string {
  return '123';
}

/**
 * Test data constants
 */
export const testData = {
  /**
   * Valid user credentials template
   */
  validUser: {
    email: 'valid@e2e.test',
    password: 'ValidPassword123!',
  },

  /**
   * Invalid credentials for error testing
   */
  invalidCredentials: {
    email: 'nonexistent@e2e.test',
    password: 'WrongPassword123!',
  },

  /**
   * Invalid email formats for validation testing
   */
  invalidEmails: ['invalid-email', 'missing@domain', '@nodomain.com', ''],

  /**
   * Invalid password formats for validation testing
   */
  invalidPasswords: {
    tooShort: '12345', // Less than 6 characters
    empty: '',
  },

  /**
   * Valid TOTP code format (for structure testing only)
   */
  validTotpFormat: '123456',

  /**
   * Invalid TOTP codes for error testing
   */
  invalidTotpCodes: {
    tooShort: '12345',
    tooLong: '1234567',
    nonNumeric: 'abcdef',
    empty: '',
  },

  /**
   * Test verification tokens
   */
  tokens: {
    invalid: 'invalid-token-12345',
    empty: '',
  },
};

import { describe, expect, test } from 'vitest';
import {
  assertPasswordPolicy,
  DEFAULT_PASSWORD_POLICY,
  getPasswordPolicyError,
} from './password-policy.js';

describe('password-policy', () => {
  test('enforces the default policy boundaries', () => {
    expect(getPasswordPolicyError('a'.repeat(11))).toBe(
      `Password must be at least ${DEFAULT_PASSWORD_POLICY.min_length} characters long.`,
    );
    expect(getPasswordPolicyError('a'.repeat(12))).toBeNull();
    expect(getPasswordPolicyError('a'.repeat(257))).toBe(
      `Password must be at most ${DEFAULT_PASSWORD_POLICY.max_length} characters long.`,
    );
  });

  test('enforces custom policy boundaries', () => {
    const policy = {
      min_length: 4,
      max_length: 6,
    };

    expect(getPasswordPolicyError('123', policy)).toBe(
      'Password must be at least 4 characters long.',
    );
    expect(getPasswordPolicyError('1234', policy)).toBeNull();
    expect(getPasswordPolicyError('1234567', policy)).toBe(
      'Password must be at most 6 characters long.',
    );
  });

  test('empty string returns min-length error', () => {
    expect(getPasswordPolicyError('')).toBe(
      `Password must be at least ${DEFAULT_PASSWORD_POLICY.min_length} characters long.`,
    );
  });

  test('exactly max length (256 chars) passes', () => {
    expect(getPasswordPolicyError('a'.repeat(256))).toBeNull();
  });

  test('unicode multi-byte chars at boundary are counted by codepoint', () => {
    const emojiPassword = '\u{1F600}'.repeat(12);
    expect(getPasswordPolicyError(emojiPassword)).toBeNull();
  });

  test('NFC-combining chars affect measured length after normalization', () => {
    const decomposed = 'cafe\u0301';
    const precomposed = 'caf\u00e9';
    expect(decomposed.length).toBe(5);
    expect(precomposed.length).toBe(4);

    const policy = { min_length: 5, max_length: 256 };
    expect(getPasswordPolicyError(decomposed, policy)).toBe(
      'Password must be at least 5 characters long.',
    );
  });

  test('assertPasswordPolicy throws a validation error for invalid custom passwords', () => {
    try {
      assertPasswordPolicy('123', {
        min_length: 4,
        max_length: 6,
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: 'VALIDATION_ERROR',
        data: 'Password must be at least 4 characters long.',
      });
      return;
    }

    throw new Error('Expected assertPasswordPolicy to throw');
  });
});

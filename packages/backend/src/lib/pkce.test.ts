import { describe, expect, test } from 'vitest';
import { generatePKCE, validatePKCE } from './pkce.js';

describe('generatePKCE', () => {
  test('should generate a valid PKCE pair with default length', async () => {
    const pkce = await generatePKCE();
    expect(pkce.verifier).toBeDefined();
    expect(pkce.challenge).toBeDefined();
    expect(pkce.method).toBe('S256');
    expect(pkce.challenge).not.toBe(pkce.verifier);
  });

  test('should accept minimum length (43)', async () => {
    const pkce = await generatePKCE(43);
    expect(pkce.verifier).toBeDefined();
    expect(pkce.method).toBe('S256');
  });

  test('should accept maximum length (128)', async () => {
    const pkce = await generatePKCE(128);
    expect(pkce.verifier).toBeDefined();
    expect(pkce.method).toBe('S256');
  });

  test('should throw for length below minimum (42)', async () => {
    await expect(generatePKCE(42)).rejects.toThrow();
  });

  test('should throw for length above maximum (129)', async () => {
    await expect(generatePKCE(129)).rejects.toThrow();
  });

  test('should generate different pairs on each call', async () => {
    const a = await generatePKCE();
    const b = await generatePKCE();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).not.toBe(b.challenge);
  });
});

describe('validatePKCE', () => {
  test('should validate a generated S256 pair', async () => {
    const pkce = await generatePKCE();
    const isValid = await validatePKCE(pkce.verifier, pkce.challenge, 'S256');
    expect(isValid).toBe(true);
  });

  test('should validate plain method', async () => {
    const verifier = 'test-plain-verifier-that-is-long-enough-for-pkce-minimum';
    const isValid = await validatePKCE(verifier, verifier, 'plain');
    expect(isValid).toBe(true);
  });

  test('should reject wrong verifier', async () => {
    const pkce = await generatePKCE();
    const isValid = await validatePKCE(
      'wrong-verifier-value',
      pkce.challenge,
      'S256',
    );
    expect(isValid).toBe(false);
  });

  test('should reject wrong challenge', async () => {
    const pkce = await generatePKCE();
    const isValid = await validatePKCE(
      pkce.verifier,
      'wrong-challenge-value',
      'S256',
    );
    expect(isValid).toBe(false);
  });

  test('should default to S256 method', async () => {
    const pkce = await generatePKCE();
    const isValid = await validatePKCE(pkce.verifier, pkce.challenge);
    expect(isValid).toBe(true);
  });
});

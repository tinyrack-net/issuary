import { describe, expect, it } from 'vitest';
import { SecurityConfigSchema } from './security.ts';

describe('SecurityConfigSchema', () => {
  describe('session_secret', () => {
    it('accepts a valid 64-character hex string (32 bytes, AES-256)', () => {
      const result = SecurityConfigSchema.safeParse({
        session_secret: 'a'.repeat(64),
        hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      });
      expect(result.success).toBe(true);
    });

    it('accepts a valid 32-character hex string (16 bytes, AES-128)', () => {
      const result = SecurityConfigSchema.safeParse({
        session_secret: 'a'.repeat(32),
        hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      });
      expect(result.success).toBe(true);
    });

    it('accepts a valid 48-character hex string (24 bytes, AES-192)', () => {
      const result = SecurityConfigSchema.safeParse({
        session_secret: 'a'.repeat(48),
        hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      });
      expect(result.success).toBe(true);
    });

    it('accepts mixed-case hex (uppercase A-F)', () => {
      const result = SecurityConfigSchema.safeParse({
        session_secret: `${'A1B2C3D4E5F6'.repeat(4)}A1B2C3D4E5F6A1B2`,
        hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      });
      expect(result.success).toBe(true);
    });

    it('rejects a short valid hex string (2 chars = 1 byte, not an AES key size)', () => {
      const result = SecurityConfigSchema.safeParse({
        session_secret: 'ab',
        hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/16.*24.*32|AES/i);
      }
    });

    it('rejects a non-hex string (e.g. base64url-encoded)', () => {
      const result = SecurityConfigSchema.safeParse({
        session_secret: 'hvLQqp4tkqWC4AVynG6GbRG9ZXbc4cf2dAKPsu3_HBc',
        hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/hex/i);
      }
    });

    it('rejects an odd-length hex string (passes min(16) but not even)', () => {
      const result = SecurityConfigSchema.safeParse({
        session_secret: 'a'.repeat(17),
        hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/even|odd|hex/i);
      }
    });

    it('rejects a hex string that decodes to a non-AES key size (33 bytes)', () => {
      const result = SecurityConfigSchema.safeParse({
        session_secret: 'a'.repeat(66),
        hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/16.*24.*32|AES/i);
      }
    });

    it('rejects an empty string', () => {
      const result = SecurityConfigSchema.safeParse({
        session_secret: '',
        hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('hash_secret', () => {
    it('accepts a valid base64url-encoded 32-byte secret', () => {
      const result = SecurityConfigSchema.safeParse({
        session_secret: 'a'.repeat(64),
        hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      });
      expect(result.success).toBe(true);
    });

    it('rejects a base64url secret that decodes to fewer than 32 bytes', () => {
      const result = SecurityConfigSchema.safeParse({
        session_secret: 'a'.repeat(64),
        hash_secret: 'MDEyMzQ1Njc4OWFi',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an invalid base64url string', () => {
      const result = SecurityConfigSchema.safeParse({
        session_secret: 'a'.repeat(64),
        hash_secret: '!!!not-base64url!!!',
      });
      expect(result.success).toBe(false);
    });
  });
});

import { describe, expect, test } from 'vitest';
import z from 'zod';
import { parseWithZod } from './parse-with-zod.js';

describe('parseWithZod', () => {
  test('parses trimmed string values', async () => {
    await expect(
      parseWithZod('  demo-name  ', {
        label: 'name',
        schema: z.string().trim().min(1, 'must not be empty'),
      }),
    ).resolves.toBe('demo-name');
  });

  test('supports async schema validation', async () => {
    const schema = z.string().refine(async (value) => value === 'expected', {
      message: 'must equal expected',
    });

    await expect(
      parseWithZod('expected', {
        label: 'token',
        schema,
      }),
    ).resolves.toBe('expected');
  });

  test('formats nested validation errors with labels', async () => {
    const schema = z.object({
      issuer: z.string().url('must be a valid URL'),
    });

    await expect(
      parseWithZod('ignored', {
        coerce: () => ({ issuer: 'not-a-url' }),
        label: 'config',
        schema,
      }),
    ).rejects.toThrow('config.issuer: must be a valid URL');
  });
});

import { Command } from '@oclif/core';
import { describe, expect, test } from 'vitest';
import z from 'zod';
import { parseWithZod } from './parse-with-zod.js';
import { zodArg } from './zod-arg.js';
import { zodFlag } from './zod-flag.js';

class ParseCommand extends Command {
  static override flags = {
    name: zodFlag(
      z.string().trim().min(1, 'must not be empty').describe('Name'),
    ),
  };

  static override args = {
    slug: zodArg(
      z
        .string()
        .regex(/^[a-z0-9-]+$/, 'must be a valid slug')
        .describe('Slug'),
    ),
  };

  async run() {
    return this.parse(ParseCommand);
  }
}

class OptionalCommand extends Command {
  static override flags = {
    mode: zodFlag(
      z.enum(['json', 'pretty']).default('json').describe('Output mode'),
    ),
  };

  static override args = {
    path: zodArg(z.string().trim().min(1).optional().describe('Path')),
  };

  async run() {
    return this.parse(OptionalCommand);
  }
}

describe('CLI Zod parsers', () => {
  test('parses string args and flags through oclif', async () => {
    const result = await ParseCommand.run(
      ['demo-slug', '--name', '  demo-name  '],
      import.meta.url,
    );

    expect(result.args.slug).toBe('demo-slug');
    expect(result.flags.name).toBe('demo-name');
  });

  test('derives metadata from schema', async () => {
    const requiredFlag = zodFlag(z.string().describe('Config path'));
    const optionalArg = zodArg(z.string().optional().describe('Output path'));
    const defaultedFlag = zodFlag(
      z.enum(['json', 'pretty']).default('json').describe('Output mode'),
    );

    expect(requiredFlag.description).toBe('Config path');
    expect(requiredFlag.required).toBe(true);
    expect(optionalArg.description).toBe('Output path');
    expect(optionalArg.required).toBeUndefined();
    expect(defaultedFlag.default).toBe('json');
  });

  test('uses schema optionality and defaults at runtime', async () => {
    const result = await OptionalCommand.run([], import.meta.url);

    expect(result.args.path).toBeUndefined();
    expect(result.flags.mode).toBe('json');
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

import { describe, expect, test } from 'vitest';
import type z from 'zod';
import { ConfigValidationError, formatConfigError } from './format-error.js';

describe('formatConfigError', () => {
  test('formats a single issue with path and error', () => {
    const issues: z.core.$ZodIssue[] = [
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['app', 'cookie_secret'],
        message: 'Invalid input: expected string, received number',
      },
    ];

    const result = formatConfigError(issues);

    expect(result).toContain('Configuration validation failed (1 issue):');
    expect(result).toContain('1. app.cookie_secret');
    expect(result).toContain(
      'Error: Invalid input: expected string, received number',
    );
    expect(result).toContain('Expected: string');
  });

  test('formats multiple issues with correct numbering', () => {
    const issues: z.core.$ZodIssue[] = [
      {
        code: 'too_small',
        minimum: 16,
        inclusive: true,
        origin: 'string',
        path: ['app', 'cookie_secret'],
        message: 'Too small: expected string to have >=16 characters',
      },
      {
        code: 'invalid_value',
        values: ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'],
        path: ['logging', 'level'],
        message:
          'Invalid option: expected one of "trace"|"debug"|"info"|"warn"|"error"|"fatal"|"silent"',
      },
    ];

    const result = formatConfigError(issues);

    expect(result).toContain('Configuration validation failed (2 issues):');
    expect(result).toContain('1. app.cookie_secret');
    expect(result).toContain(
      'Error: Too small: expected string to have >=16 characters',
    );
    expect(result).toContain('Expected: string >= 16');
    expect(result).toContain('2. logging.level');
    expect(result).toContain(
      'Expected: "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent"',
    );
  });

  test('formats nested paths with array indices', () => {
    const issues: z.core.$ZodIssue[] = [
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['clients', 0, 'redirect_uris', 1],
        message: 'Invalid input: expected string, received number',
      },
    ];

    const result = formatConfigError(issues);

    expect(result).toContain('1. clients[0].redirect_uris[1]');
  });

  test('formats too_big issue', () => {
    const issues: z.core.$ZodIssue[] = [
      {
        code: 'too_big',
        maximum: 100,
        inclusive: true,
        origin: 'number',
        path: ['app', 'port'],
        message: 'Too big: expected number to be <=100',
      },
    ];

    const result = formatConfigError(issues);

    expect(result).toContain('Error: Too big: expected number to be <=100');
    expect(result).toContain('Expected: number <= 100');
  });

  test('formats invalid_format issue', () => {
    const issues: z.core.$ZodIssue[] = [
      {
        code: 'invalid_format',
        format: 'url',
        path: ['app', 'background_url'],
        message: 'Invalid URL',
      },
    ];

    const result = formatConfigError(issues);

    expect(result).toContain('Error: Invalid URL');
    expect(result).toContain('Expected: valid url');
  });

  test('formats invalid_union issue without Expected line', () => {
    const issues: z.core.$ZodIssue[] = [
      {
        code: 'invalid_union',
        errors: [],
        path: ['smtp'],
        message: 'Invalid union: no matching variant',
      },
    ];

    const result = formatConfigError(issues);

    expect(result).toContain('Error: Invalid union: no matching variant');
    expect(result).not.toContain('Expected:');
  });

  test('formats empty path as (root)', () => {
    const issues: z.core.$ZodIssue[] = [
      {
        code: 'invalid_type',
        expected: 'object',
        path: [],
        message: 'Invalid input: expected object, received null',
      },
    ];

    const result = formatConfigError(issues);

    expect(result).toContain('1. (root)');
  });
});

describe('ConfigValidationError', () => {
  test('is an Error instance', () => {
    const err = new ConfigValidationError([
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['app', 'name'],
        message: 'Invalid input: expected string, received number',
      },
    ]);

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ConfigValidationError);
    expect(err.name).toBe('ConfigValidationError');
  });

  test('message contains formatted output', () => {
    const err = new ConfigValidationError([
      {
        code: 'too_small',
        minimum: 16,
        inclusive: true,
        origin: 'string',
        path: ['app', 'cookie_secret'],
        message: 'Too small: expected string to have >=16 characters',
      },
    ]);

    expect(err.message).toContain('Configuration validation failed');
    expect(err.message).toContain('app.cookie_secret');
  });
});

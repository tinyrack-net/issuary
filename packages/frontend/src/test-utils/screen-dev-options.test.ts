import { describe, expect, test } from 'vitest';
import {
  normalizeScreenDevArgs,
  resolveScreenDevMode,
} from './screen-dev-options.js';

describe('resolveScreenDevMode', () => {
  test('opens the interactive picker when a TTY has no arguments', () => {
    expect(resolveScreenDevMode({ help: false, list: false }, true)).toEqual({
      type: 'interactive',
    });
  });

  test('requires an explicit scenario outside a TTY', () => {
    expect(resolveScreenDevMode({ help: false, list: false }, false)).toEqual({
      type: 'missing-scenario',
    });
  });

  test('keeps explicit scenario and variant options', () => {
    expect(
      resolveScreenDevMode(
        {
          help: false,
          list: false,
          scenario: 'login',
          variant: 'mobile',
        },
        true,
      ),
    ).toEqual({ type: 'run', scenario: 'login', variant: 'mobile' });
  });
});

describe('normalizeScreenDevArgs', () => {
  test('accepts a pnpm-style leading option separator', () => {
    expect(normalizeScreenDevArgs(['--', '--list'])).toEqual(['--list']);
  });

  test('preserves ordinary arguments', () => {
    expect(normalizeScreenDevArgs(['--scenario', 'login'])).toEqual([
      '--scenario',
      'login',
    ]);
  });
});

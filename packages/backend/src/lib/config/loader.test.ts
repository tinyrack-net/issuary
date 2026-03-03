import { describe, expect, test, vi } from 'vitest';
import { ConfigValidationError } from '#backend/lib/format-zod-error.js';
import { MINIMAL_TEST_CONFIG } from '#backend/test-utils/index.js';
import { resolveConfig } from './loader.js';

vi.mock('nodemailer', () => ({
  default: {
    createTestAccount: async () => ({
      smtp: {
        host: 'smtp.test.local',
        port: 465,
        secure: true,
      },
      user: 'test-user',
      pass: 'test-pass',
    }),
  },
}));

describe('resolveConfig', () => {
  test('rejects standalone frontend config', async () => {
    const promise = resolveConfig({
      ...MINIMAL_TEST_CONFIG,
      app: {
        ...MINIMAL_TEST_CONFIG.app,
        frontend: {
          enabled: true,
        },
      },
    });

    await expect(promise).rejects.toBeInstanceOf(ConfigValidationError);
    await expect(promise).rejects.toThrow('app.frontend');
  });

  test('rejects standalone html variables config', async () => {
    const promise = resolveConfig({
      ...MINIMAL_TEST_CONFIG,
      app: {
        ...MINIMAL_TEST_CONFIG.app,
        html_variables: {
          TITLE: 'TinyAuth',
        },
      },
    });

    await expect(promise).rejects.toBeInstanceOf(ConfigValidationError);
    await expect(promise).rejects.toThrow('app.html_variables');
  });

  test('returns backend-only resolved config', async () => {
    const resolved = await resolveConfig(MINIMAL_TEST_CONFIG);

    expect(Object.hasOwn(resolved.app, 'frontend')).toBe(false);
    expect(Object.hasOwn(resolved.app, 'html_variables')).toBe(false);
  });

  test('resolves smtp test accounts', async () => {
    const resolved = await resolveConfig(MINIMAL_TEST_CONFIG);

    expect(resolved.smtp).toBeDefined();
    expect(resolved.smtp?.test).toBe(true);
    expect(resolved.smtp?.host).toBe('smtp.test.local');
    expect(resolved.smtp?.user).toBe('test-user');
  });
});

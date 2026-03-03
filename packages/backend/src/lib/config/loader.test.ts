import { describe, expect, test, vi } from 'vitest';
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
  test('ignores standalone frontend config', async () => {
    const resolved = await resolveConfig({
      ...MINIMAL_TEST_CONFIG,
      app: {
        ...MINIMAL_TEST_CONFIG.app,
        frontend: {
          enabled: true,
        },
      },
    });

    expect(Object.hasOwn(resolved.app, 'frontend')).toBe(false);
    expect(Object.hasOwn(resolved.app, 'html_variables')).toBe(false);
  });

  test('ignores standalone html variables config', async () => {
    const resolved = await resolveConfig({
      ...MINIMAL_TEST_CONFIG,
      app: {
        ...MINIMAL_TEST_CONFIG.app,
        html_variables: {
          TITLE: 'TinyAuth',
        },
      },
    });

    expect(Object.hasOwn(resolved.app, 'frontend')).toBe(false);
    expect(Object.hasOwn(resolved.app, 'html_variables')).toBe(false);
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

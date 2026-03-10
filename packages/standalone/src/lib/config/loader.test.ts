import { describe, expect, test, vi } from 'vitest';
import { resolveConfig } from '#standalone/lib/load-config.js';

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

const MINIMAL_CONFIG = {
  app: {
    allowed_signup_emails: ['*'],
  },
  security: {
    session_secret:
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
    hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
    pbkdf2_iterations: 1000,
  },
};

describe('resolveConfig', () => {
  test('strips standalone-only fields (frontend, html_variables)', async () => {
    const resolved = await resolveConfig({
      ...MINIMAL_CONFIG,
      app: {
        ...MINIMAL_CONFIG.app,
        frontend: {
          enabled: true,
        },
        html_variables: {
          TITLE: 'TinyAuth',
        },
      },
    });

    expect(Object.hasOwn(resolved.app, 'frontend')).toBe(false);
    expect(Object.hasOwn(resolved.app, 'html_variables')).toBe(false);
  });

  test('resolves smtp test accounts', async () => {
    const resolved = await resolveConfig({
      ...MINIMAL_CONFIG,
      smtp: { test: true },
    });

    expect(resolved.mail).toBeDefined();
    expect(resolved.mail?.from).toBeDefined();
    expect(typeof resolved.mail?.createTransport).toBe('function');
  });

  test('returns composed database config', async () => {
    const resolved = await resolveConfig(MINIMAL_CONFIG);

    expect(typeof resolved.database.getMikroOrmOptions).toBe('function');
    expect(typeof resolved.database.initialize).toBe('function');
  });

  test('rejects password policy where max_length is less than min_length', async () => {
    await expect(
      resolveConfig({
        ...MINIMAL_CONFIG,
        auth: {
          password: {
            policy: {
              min_length: 10,
              max_length: 5,
            },
          },
        },
      }),
    ).rejects.toThrow('max_length');
  });

  test('accepts valid custom password policy', async () => {
    await expect(
      resolveConfig({
        ...MINIMAL_CONFIG,
        auth: {
          password: {
            policy: {
              min_length: 8,
              max_length: 64,
            },
          },
        },
      }),
    ).resolves.toBeDefined();
  });

  test('rejects removed app.cookie_secret config', async () => {
    await expect(
      resolveConfig({
        ...MINIMAL_CONFIG,
        app: {
          ...MINIMAL_CONFIG.app,
          cookie_secret:
            '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
        },
      }),
    ).rejects.toThrow('cookie_secret');
  });

  test('rejects invalid hash_secret with wrong byte length', async () => {
    await expect(
      resolveConfig({
        ...MINIMAL_CONFIG,
        security: {
          ...MINIMAL_CONFIG.security,
          hash_secret: 'MDEyMzQ1Njc4OWFiY2Rl',
          pbkdf2_iterations: 1000,
        },
      }),
    ).rejects.toThrow();
  });

  test('rejects removed security.hash_master_secret_version config', async () => {
    await expect(
      resolveConfig({
        ...MINIMAL_CONFIG,
        security: {
          ...MINIMAL_CONFIG.security,
          pbkdf2_iterations: 1000,
          hash_master_secret_version: 1,
        },
      }),
    ).rejects.toThrow('hash_master_secret_version');
  });
});

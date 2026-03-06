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
    cookie_secret:
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
    allowed_signup_emails: ['*'],
  },
  security: {
    hash_master_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
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

    expect(resolved.smtp).toBeDefined();
    expect(resolved.smtp?.test).toBe(true);
    expect(resolved.smtp?.host).toBe('smtp.test.local');
    expect(resolved.smtp?.user).toBe('test-user');
    expect(typeof resolved.smtp?.createTransport).toBe('function');
    expect(typeof resolved.smtp?.getTestMessageUrl).toBe('function');
  });

  test('returns composed database config', async () => {
    const resolved = await resolveConfig(MINIMAL_CONFIG);

    expect(resolved.database.type).toBe('sqlite');
    expect(typeof resolved.database.getMikroOrmOptions).toBe('function');
  });

  test('validates config users against the configured password policy', async () => {
    await expect(
      resolveConfig({
        ...MINIMAL_CONFIG,
        auth: {
          password: {
            policy: {
              min_length: 4,
              max_length: 6,
            },
          },
        },
        users: [
          {
            sub: 'config-user',
            email: 'config-user@example.com',
            password: '123',
            role: 'user',
          },
        ],
      }),
    ).rejects.toThrow('Password must be at least 4 characters long.');
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

  test('rejects invalid hash_master_secret with wrong byte length', async () => {
    await expect(
      resolveConfig({
        ...MINIMAL_CONFIG,
        security: {
          hash_master_secret: 'MDEyMzQ1Njc4OWFiY2Rl',
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
          hash_master_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
          pbkdf2_iterations: 1000,
          hash_master_secret_version: 1,
        },
      }),
    ).rejects.toThrow('hash_master_secret_version');
  });
});

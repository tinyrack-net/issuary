import { describe, expect, test, vi } from 'vitest';
import { resolveConfig } from '../load-config.ts';

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
  registration: {
    enabled: true,
    allowed_email_patterns: ['*'],
  },
  security: {
    session_secret:
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
    hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
    pbkdf2_iterations: 1000,
  },
};

describe('resolveConfig', () => {
  test('resolves frontend handler from standalone frontend config', async () => {
    const resolved = await resolveConfig({
      ...MINIMAL_CONFIG,
      frontend: {
        enabled: true,
        html_variables: {
          TITLE: 'TinyAuth',
        },
      },
    });

    expect(typeof resolved.frontend).toBe('function');
  });

  test('preserves openapi settings in backend runtime config', async () => {
    const resolved = await resolveConfig({
      ...MINIMAL_CONFIG,
      openapi: {
        enabled: false,
        title: 'Custom API',
        description: 'Custom description',
        ui_title: 'Custom API Reference',
      },
    });

    expect(resolved.openapi).toEqual({
      enabled: false,
      title: 'Custom API',
      description: 'Custom description',
      ui_title: 'Custom API Reference',
    });
  });

  test('resolves test email accounts', async () => {
    const resolved = await resolveConfig({
      ...MINIMAL_CONFIG,
      email: { transport: 'test' },
    });

    expect(resolved.email).toBeDefined();
    expect(resolved.email?.from).toBeUndefined();
    expect(typeof resolved.email?.createTransport).toBe('function');
  });

  test('returns composed database config', async () => {
    const resolved = await resolveConfig(MINIMAL_CONFIG);

    expect(typeof resolved.database.getMikroOrmOptions).toBe('function');
    expect(typeof resolved.database.initialize).toBe('function');
  });

  test('composes postgres driver options from standalone config', async () => {
    const resolved = await resolveConfig({
      ...MINIMAL_CONFIG,
      database: {
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        name: 'tinyauth',
        debug: 'true',
        driver_options: {
          ssl: false,
        },
      },
    });

    const options = await resolved.database.getMikroOrmOptions();

    expect(options.debug).toBe(true);
    expect(options.driverOptions).toEqual({ ssl: false });
  });

  test('composes a scheduler adapter from standalone defaults', async () => {
    const resolved = await resolveConfig(MINIMAL_CONFIG);

    expect(resolved.scheduler).toBeDefined();
    if (!resolved.scheduler) {
      throw new Error('Expected scheduler to be defined');
    }

    const handle = await resolved.scheduler.start({
      runCleanup: async () => {},
    });

    expect(handle.getNextRunAt?.()).toBeInstanceOf(Date);
    await handle.stop();
  });

  test('omits the scheduler adapter when standalone scheduler is disabled', async () => {
    const resolved = await resolveConfig({
      ...MINIMAL_CONFIG,
      scheduler: {
        enabled: false,
      },
    });

    expect(resolved.scheduler).toBeUndefined();
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

  test('coerces env-style scalar strings in declarative config', async () => {
    await expect(
      resolveConfig({
        ...MINIMAL_CONFIG,
        auth: {
          password: {
            enabled: 'true',
            two_factor: {
              enrollment_required: 'false',
            },
            totp: {
              enabled: 'false',
            },
            policy: {
              min_length: '8',
              max_length: '64',
            },
          },
          passkey: {
            enabled: 'false',
          },
        },
        database: {
          type: 'sqlite',
          test: 'true',
          debug: 'true',
        },
        email: {
          transport: 'smtp',
          host: 'smtp.example.com',
          port: '465',
          secure: 'true',
          user: 'mailer',
          password: 'secret',
        },
        cleanup: {
          revoked_tokens: {
            enabled: 'false',
          },
        },
        identity_providers: [
          {
            id: 'github',
            type: 'github',
            enabled: 'true',
            client_id: 'github-client-id',
            client_secret: 'github-client-secret',
          },
        ],
        frontend: {
          enabled: 'true',
          mode: 'static',
        },
      }),
    ).resolves.toBeDefined();
  });

  test('rejects removed app.cookie_secret config', async () => {
    const errorMessage = await resolveConfig({
      ...MINIMAL_CONFIG,
      app: {
        cookie_secret:
          '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
      },
    }).then(
      () => '',
      (error: unknown) => String(error),
    );

    expect(errorMessage).toContain('"app"');
    expect(errorMessage).toContain('Unrecognized key');
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

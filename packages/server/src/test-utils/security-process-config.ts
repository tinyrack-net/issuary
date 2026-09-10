import { createHash } from 'node:crypto';
import { postgres } from '../entrypoints/database/postgres/postgres.js';
import { sqlite } from '../entrypoints/database/sqlite/sqlite.js';
import { google } from '../entrypoints/identity-providers/google.js';
import type { IssuaryRuntimeConfigInput } from '../lib/config/index.js';
import { TEST_OAUTH_CLIENT_CONFIG, TEST_USER_CONFIG } from './fixtures.js';

export function securityProcessConfig(path: string) {
  const port = process.env['SECURITY_POSTGRES_PORT'];
  return {
    database: port
      ? postgres({
          host: '127.0.0.1',
          port: Number(port),
          name: `issuary_security_${createHash('sha256').update(path).digest('hex').slice(0, 24)}`,
          user: 'postgres',
          password: 'isolated-test-only',
          driverOptions: { ssl: false },
        })
      : sqlite({ path, test: false }),
    logging: { level: 'silent' },
    admin: { enabled: true },
    registration: { enabled: true, email_verification_required: false },
    auth: {
      account_selection: { enabled: true, mode: 'smart' },
      passkey: { enabled: true },
      password: { totp: { enabled: true } },
    },
    identity_providers: [
      google({
        id: 'google',
        enabled: true,
        client_id: 'fixture',
        client_secret: 'fixture',
        email_conflict_strategy: 'require_link',
      }),
    ],
    security: {
      session_secret:
        '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
      hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
    },
    users: [TEST_USER_CONFIG],
    clients: [
      {
        ...TEST_OAUTH_CLIENT_CONFIG,
        grant_types: [
          'authorization_code',
          'refresh_token',
          'urn:ietf:params:oauth:grant-type:device_code',
        ],
        scope: 'openid profile email offline_access',
      },
    ],
  } satisfies IssuaryRuntimeConfigInput;
}

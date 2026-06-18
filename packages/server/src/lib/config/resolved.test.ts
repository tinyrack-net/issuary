import { describe, expect, test } from 'vitest';
import { sqlite } from '../../entrypoints/database/sqlite/sqlite.ts';
import { ACCOUNT_DELETION_CONFIG_DEFAULT } from './account-deletion.ts';
import { AUTH_CONFIG_DEFAULT } from './auth.ts';
import { BRANDING_CONFIG_DEFAULT } from './branding.ts';
import { CLEANUP_CONFIG_DEFAULT } from './cleanup.ts';
import { CLIENT_CONFIGS_DEFAULT } from './client.ts';
import { I18N_CONFIG_DEFAULT } from './i18n.ts';
import { IDENTITY_PROVIDER_CONFIGS_DEFAULT } from './identity-providers.ts';
import type { SchedulerConfig } from './index.ts';
import { LOGGING_CONFIG_DEFAULT } from './logging.ts';
import { OPENAPI_CONFIG_DEFAULT } from './openapi.ts';
import { REGISTRATION_CONFIG_DEFAULT } from './registration.ts';
import {
  type TinyAuthRuntimeConfigInput,
  TinyAuthRuntimeConfigSchema,
} from './resolved.ts';
import { SECURITY_CONFIG_DEFAULT } from './security.ts';
import { SERVER_CONFIG_DEFAULT } from './server.ts';
import { TERMS_CONFIG_DEFAULT } from './terms.ts';
import { TOKENS_CONFIG_DEFAULT } from './tokens.ts';
import { USER_CONFIGS_DEFAULT } from './user.ts';

const MINIMAL_INPUT_CONFIG = {
  database: sqlite({ path: './test.db', test: true }),
  security: {
    session_secret:
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
    hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
  },
} satisfies TinyAuthRuntimeConfigInput;

function createSchedulerConfig(): SchedulerConfig {
  return {
    start() {
      return {
        stop() {},
        getNextRunAt() {
          return null;
        },
      };
    },
  };
}

function createClientConfig(redirectUris: string[]) {
  return {
    id: 'client-config-id',
    name: 'Client',
    client_id: 'oauth-client-id',
    redirect_uris: redirectUris,
    response_types: ['code'],
    grant_types: ['authorization_code'],
    scope: 'openid',
  };
}

function createIdentityProviderConfig(
  overrides: Record<string, string | string[] | null>,
) {
  return {
    id: 'generic-provider',
    type: 'generic_oauth',
    enabled: true,
    display_name: 'Generic Provider',
    client_id: 'generic-client-id',
    client_secret: 'generic-client-secret',
    authorization_url: 'https://vendor.example/authorize',
    token_url: 'https://vendor.example/token',
    userinfo_url: 'https://vendor.example/userinfo',
    scopes: ['openid', 'email'],
    email_conflict_strategy: 'auto_link',
    userinfo_mapping: {
      id: 'sub',
      email: 'email',
      email_verified: 'email_verified',
    },
    ...overrides,
  };
}

function expectConfigIssue(input: unknown, expectedPath: string) {
  const result = TinyAuthRuntimeConfigSchema.safeParse(input);

  expect(result.success).toBe(false);
  if (result.success) {
    throw new Error('Expected config parsing to fail.');
  }

  expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain(
    expectedPath,
  );
}

describe('TinyAuthRuntimeConfigSchema', () => {
  test('parses the minimal unresolved config and applies omitted defaults', () => {
    const parsed = TinyAuthRuntimeConfigSchema.parse(MINIMAL_INPUT_CONFIG);

    expect(parsed.database).toBe(MINIMAL_INPUT_CONFIG.database);
    expect(parsed.server).toEqual(SERVER_CONFIG_DEFAULT);
    expect(parsed.tokens).toEqual(TOKENS_CONFIG_DEFAULT);
    expect(parsed.i18n).toEqual(I18N_CONFIG_DEFAULT);
    expect(parsed.branding).toEqual(BRANDING_CONFIG_DEFAULT);
    expect(parsed.registration).toEqual(REGISTRATION_CONFIG_DEFAULT);
    expect(parsed.account_deletion).toEqual(ACCOUNT_DELETION_CONFIG_DEFAULT);
    expect(parsed.logging).toEqual(LOGGING_CONFIG_DEFAULT);
    expect(parsed.openapi).toEqual(OPENAPI_CONFIG_DEFAULT);
    expect(parsed.auth).toEqual(AUTH_CONFIG_DEFAULT);
    expect(parsed.security).toEqual({
      ...MINIMAL_INPUT_CONFIG.security,
      pbkdf2_iterations: SECURITY_CONFIG_DEFAULT.pbkdf2_iterations,
    });
    expect(parsed.cleanup).toEqual(CLEANUP_CONFIG_DEFAULT);
    expect(parsed.scheduler).toBeUndefined();
    expect(parsed.terms).toEqual(TERMS_CONFIG_DEFAULT);
    expect(parsed.clients).toEqual(CLIENT_CONFIGS_DEFAULT);
    expect(parsed.users).toEqual(USER_CONFIGS_DEFAULT);
    expect(parsed.identity_providers).toEqual(
      IDENTITY_PROVIDER_CONFIGS_DEFAULT,
    );
    expect(parsed.email).toBeUndefined();
    expect(parsed.frontend).toBeUndefined();
  });

  test('applies nested defaults when only part of a subtree is provided', () => {
    const partialInput = {
      ...MINIMAL_INPUT_CONFIG,
      auth: {
        password: {
          totp: {
            enabled: true,
          },
        },
      },
      account_deletion: {
        retention: '7d',
      },
      server: {
        public_origin: 'http://example.com',
      },
      branding: {
        title: {
          en: 'Custom',
        },
      },
      openapi: {
        enabled: false,
        title: 'Custom API',
      },
    } satisfies TinyAuthRuntimeConfigInput;

    const parsed = TinyAuthRuntimeConfigSchema.parse(partialInput);

    expect(parsed.auth.password).toEqual({
      ...AUTH_CONFIG_DEFAULT.password,
      totp: {
        ...AUTH_CONFIG_DEFAULT.password.totp,
        enabled: true,
      },
    });
    expect(parsed.auth.passkey).toEqual(AUTH_CONFIG_DEFAULT.passkey);

    expect(parsed.account_deletion).toEqual({
      ...ACCOUNT_DELETION_CONFIG_DEFAULT,
      retention: '7d',
    });
    expect(parsed.cleanup.revoked_tokens).toEqual(
      CLEANUP_CONFIG_DEFAULT.revoked_tokens,
    );

    expect(parsed.server.public_origin).toBe('http://example.com');
    expect(parsed.server.listen_port).toBe(SERVER_CONFIG_DEFAULT.listen_port);
    expect(parsed.branding.title).toEqual({
      en: 'Custom',
    });
    expect(parsed.branding.subtitle).toEqual(BRANDING_CONFIG_DEFAULT.subtitle);
    expect(parsed.openapi).toEqual({
      ...OPENAPI_CONFIG_DEFAULT,
      enabled: false,
      title: 'Custom API',
    });
    expect(parsed.registration.allowed_email_patterns).toEqual(
      REGISTRATION_CONFIG_DEFAULT.allowed_email_patterns,
    );
  });

  test('keeps a configured scheduler adapter by reference', () => {
    const scheduler = createSchedulerConfig();

    const parsed = TinyAuthRuntimeConfigSchema.parse({
      ...MINIMAL_INPUT_CONFIG,
      scheduler,
    });

    expect(parsed.scheduler).toBe(scheduler);
  });

  test('caps config-authored user and client identifiers at 255 characters', () => {
    const maxLengthId = 'x'.repeat(255);
    const tooLongId = 'x'.repeat(256);

    expect(() =>
      TinyAuthRuntimeConfigSchema.parse({
        ...MINIMAL_INPUT_CONFIG,
        users: [
          {
            sub: maxLengthId,
            email: 'user@example.com',
            password: 'password',
            role: 'user',
          },
        ],
        clients: [
          {
            id: maxLengthId,
            name: 'Client',
            client_id: 'oauth-client-id',
            redirect_uris: ['http://localhost/callback'],
            response_types: ['code'],
            grant_types: ['authorization_code'],
            scope: 'openid',
          },
        ],
      }),
    ).not.toThrow();

    expect(() =>
      TinyAuthRuntimeConfigSchema.parse({
        ...MINIMAL_INPUT_CONFIG,
        users: [
          {
            sub: tooLongId,
            email: 'user@example.com',
            password: 'password',
            role: 'user',
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      TinyAuthRuntimeConfigSchema.parse({
        ...MINIMAL_INPUT_CONFIG,
        clients: [
          {
            id: tooLongId,
            name: 'Client',
            client_id: 'oauth-client-id',
            redirect_uris: ['http://localhost/callback'],
            response_types: ['code'],
            grant_types: ['authorization_code'],
            scope: 'openid',
          },
        ],
      }),
    ).toThrow();
  });

  test('does not apply the config id cap to OAuth client_id', () => {
    expect(() =>
      TinyAuthRuntimeConfigSchema.parse({
        ...MINIMAL_INPUT_CONFIG,
        clients: [
          {
            id: 'client-config-id',
            name: 'Client',
            client_id: 'x'.repeat(256),
            redirect_uris: ['http://localhost/callback'],
            response_types: ['code'],
            grant_types: ['authorization_code'],
            scope: 'openid',
          },
        ],
      }),
    ).not.toThrow();
  });

  test.each([
    ['response_types', { response_types: ['token'] }],
    ['response_types', { response_types: [] }],
    ['grant_types', { grant_types: ['password'] }],
    ['grant_types', { grant_types: [] }],
  ])('rejects unsupported or empty OAuth client %s', (_field, overrides) => {
    expect(() =>
      TinyAuthRuntimeConfigSchema.parse({
        ...MINIMAL_INPUT_CONFIG,
        clients: [
          {
            ...createClientConfig(['http://localhost/callback']),
            ...overrides,
          },
        ],
      }),
    ).toThrow();
  });

  test('rejects inconsistent OAuth client response and grant type combinations', () => {
    expect(() =>
      TinyAuthRuntimeConfigSchema.parse({
        ...MINIMAL_INPUT_CONFIG,
        clients: [
          {
            ...createClientConfig(['http://localhost/callback']),
            response_types: ['code'],
            grant_types: ['refresh_token'],
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      TinyAuthRuntimeConfigSchema.parse({
        ...MINIMAL_INPUT_CONFIG,
        clients: [
          {
            ...createClientConfig(['http://localhost/callback']),
            response_types: ['id_token'],
            grant_types: ['authorization_code'],
          },
        ],
      }),
    ).toThrow();
  });

  test('normalizes OAuth client scopes using OAuth scope-token whitespace rules', () => {
    const parsed = TinyAuthRuntimeConfigSchema.parse({
      ...MINIMAL_INPUT_CONFIG,
      clients: [
        {
          ...createClientConfig(['http://localhost/callback']),
          scope: ' openid   profile email ',
        },
      ],
    });

    expect(parsed.clients[0]?.scope).toBe('openid profile email');
  });

  test.each([
    ['empty scope', { scope: '' }],
    ['scope with control character', { scope: 'openid\nemail' }],
    ['empty client_secret', { client_secret: '' }],
    ['empty client_id', { client_id: '' }],
  ])('rejects OAuth client config with %s', (_label, overrides) => {
    expect(() =>
      TinyAuthRuntimeConfigSchema.parse({
        ...MINIMAL_INPUT_CONFIG,
        clients: [
          {
            ...createClientConfig(['http://localhost/callback']),
            ...overrides,
          },
        ],
      }),
    ).toThrow();
  });

  test('rejects insecure remote OAuth client redirect URIs', () => {
    expectConfigIssue(
      {
        ...MINIMAL_INPUT_CONFIG,
        clients: [createClientConfig(['http://example.com/callback'])],
      },
      'clients.0.redirect_uris.0',
    );
  });

  test('allows HTTPS and local HTTP OAuth client redirect URIs', () => {
    expect(() =>
      TinyAuthRuntimeConfigSchema.parse({
        ...MINIMAL_INPUT_CONFIG,
        clients: [
          createClientConfig([
            'https://app.example/callback',
            'http://localhost:3000/callback',
            'http://127.0.0.1:3000/callback',
            'http://[::1]:3000/callback',
          ]),
        ],
      }),
    ).not.toThrow();
  });

  test('rejects redirect URIs with fragments or wildcards', () => {
    expectConfigIssue(
      {
        ...MINIMAL_INPUT_CONFIG,
        clients: [createClientConfig(['https://app.example/callback#token'])],
      },
      'clients.0.redirect_uris.0',
    );

    expectConfigIssue(
      {
        ...MINIMAL_INPUT_CONFIG,
        clients: [createClientConfig(['https://app.example/*'])],
      },
      'clients.0.redirect_uris.0',
    );
  });

  test('allows HTTPS and local HTTP JWKS URLs for OIDC providers', () => {
    const parsed = TinyAuthRuntimeConfigSchema.parse({
      ...MINIMAL_INPUT_CONFIG,
      identity_providers: [
        {
          id: 'https-jwks-provider',
          type: 'generic_oauth',
          enabled: true,
          display_name: 'HTTPS JWKS Provider',
          client_id: 'https-jwks-client-id',
          client_secret: 'https-jwks-client-secret',
          authorization_url: 'https://vendor.example/authorize',
          token_url: 'https://vendor.example/token',
          userinfo_url: null,
          jwks_url: 'https://vendor.example/.well-known/jwks.json',
          issuer: 'https://vendor.example',
          scopes: ['openid', 'email'],
          email_conflict_strategy: 'auto_link',
          userinfo_mapping: {
            id: 'sub',
            email: 'email',
            email_verified: 'email_verified',
          },
        },
        {
          id: 'local-jwks-provider',
          type: 'generic_oauth',
          enabled: true,
          display_name: 'Local JWKS Provider',
          client_id: 'local-jwks-client-id',
          client_secret: 'local-jwks-client-secret',
          authorization_url: 'http://localhost:1234/authorize',
          token_url: 'http://localhost:1234/token',
          userinfo_url: null,
          jwks_url: 'http://localhost:1234/jwks',
          issuer: 'http://localhost:1234',
          scopes: ['openid', 'email'],
          email_conflict_strategy: 'auto_link',
          userinfo_mapping: {
            id: 'sub',
            email: 'email',
            email_verified: 'email_verified',
          },
        },
      ],
    });

    expect(
      parsed.identity_providers.map((provider) => provider.jwks_url),
    ).toEqual([
      'https://vendor.example/.well-known/jwks.json',
      'http://localhost:1234/jwks',
    ]);
    expect(
      parsed.identity_providers.map((provider) => provider.issuer),
    ).toEqual(['https://vendor.example', 'http://localhost:1234']);
  });

  test('requires issuer for generic ID-token-only JWKS providers', () => {
    expect(() =>
      TinyAuthRuntimeConfigSchema.parse({
        ...MINIMAL_INPUT_CONFIG,
        identity_providers: [
          {
            id: 'generic-id-token-provider',
            type: 'generic_oauth',
            enabled: true,
            display_name: 'Generic ID Token Provider',
            client_id: 'generic-id-token-client-id',
            client_secret: 'generic-id-token-client-secret',
            authorization_url: 'https://vendor.example/authorize',
            token_url: 'https://vendor.example/token',
            userinfo_url: null,
            jwks_url: 'https://vendor.example/.well-known/jwks.json',
            scopes: ['openid', 'email'],
            email_conflict_strategy: 'auto_link',
            userinfo_mapping: {
              id: 'sub',
              email: 'email',
              email_verified: 'email_verified',
            },
          },
        ],
      }),
    ).toThrow();
  });

  test('rejects insecure remote identity provider endpoint URLs', () => {
    expectConfigIssue(
      {
        ...MINIMAL_INPUT_CONFIG,
        identity_providers: [
          createIdentityProviderConfig({
            authorization_url: 'http://example.com/authorize',
          }),
        ],
      },
      'identity_providers.0.authorization_url',
    );

    expectConfigIssue(
      {
        ...MINIMAL_INPUT_CONFIG,
        identity_providers: [
          createIdentityProviderConfig({
            token_url: 'http://example.com/token',
          }),
        ],
      },
      'identity_providers.0.token_url',
    );

    expectConfigIssue(
      {
        ...MINIMAL_INPUT_CONFIG,
        identity_providers: [
          createIdentityProviderConfig({
            userinfo_url: 'http://example.com/userinfo',
          }),
        ],
      },
      'identity_providers.0.userinfo_url',
    );

    expectConfigIssue(
      {
        ...MINIMAL_INPUT_CONFIG,
        identity_providers: [
          createIdentityProviderConfig({
            email_url: 'http://example.com/emails',
          }),
        ],
      },
      'identity_providers.0.email_url',
    );
  });

  test('allows local HTTP identity provider endpoint URLs', () => {
    expect(() =>
      TinyAuthRuntimeConfigSchema.parse({
        ...MINIMAL_INPUT_CONFIG,
        identity_providers: [
          createIdentityProviderConfig({
            authorization_url: 'http://localhost:3000/authorize',
            token_url: 'http://127.0.0.1:3000/token',
            userinfo_url: 'http://[::1]:3000/userinfo',
            email_url: 'http://localhost:3000/emails',
          }),
        ],
      }),
    ).not.toThrow();
  });

  test('rejects invalid and insecure remote JWKS URLs', () => {
    const providerConfig = {
      id: 'bad-jwks-provider',
      type: 'generic_oauth',
      enabled: true,
      display_name: 'Bad JWKS Provider',
      client_id: 'bad-jwks-client-id',
      client_secret: 'bad-jwks-client-secret',
      authorization_url: 'https://vendor.example/authorize',
      token_url: 'https://vendor.example/token',
      userinfo_url: null,
      scopes: ['openid', 'email'],
      email_conflict_strategy: 'auto_link',
      userinfo_mapping: {
        id: 'sub',
        email: 'email',
        email_verified: 'email_verified',
      },
    };

    expect(() =>
      TinyAuthRuntimeConfigSchema.parse({
        ...MINIMAL_INPUT_CONFIG,
        identity_providers: [
          {
            ...providerConfig,
            jwks_url: 'http://example.com/jwks',
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      TinyAuthRuntimeConfigSchema.parse({
        ...MINIMAL_INPUT_CONFIG,
        identity_providers: [
          {
            ...providerConfig,
            jwks_url: 'not-a-url',
          },
        ],
      }),
    ).toThrow();
  });

  test('rejects legacy scheduler objects that are not adapters', () => {
    expect(() =>
      TinyAuthRuntimeConfigSchema.parse({
        ...MINIMAL_INPUT_CONFIG,
        scheduler: {
          enabled: true,
          cron: '0 2 * * *',
        },
      }),
    ).toThrow('Invalid SchedulerConfig');
  });
});

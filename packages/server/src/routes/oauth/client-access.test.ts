import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { UserEntitySchema } from '../../entities/user.entity.ts';
import type { AppType } from '../../entrypoints/app.ts';
import type { ClientAccessConfig } from '../../lib/config/index.ts';
import { IssuaryRuntimeConfigSchema } from '../../lib/config/index.ts';
import type { ServiceContainer } from '../../services/container.ts';
import {
  createAuthenticatedSession,
  createTestApp,
  MINIMAL_TEST_CONFIG,
  TEST_PKCE,
} from '../../test-utils/index.ts';

/**
 * Per-client access policies (`clients[].access`).
 *
 * A client with `access` only issues grants to users matching a listed sub,
 * verified email or role. The policy is enforced at the authorization
 * endpoint and re-checked at code exchange, refresh and device approval so
 * that removing a user from the policy also cuts off existing grants.
 */

const SCOPE = 'openid profile email offline_access';
const RESTRICTED = {
  clientId: 'restricted-client',
  clientSecret: 'restricted-client-secret',
  redirectUri: 'http://localhost:8080/restricted-callback',
} as const;
const OPEN = {
  clientId: 'open-client',
  clientSecret: 'open-client-secret',
  redirectUri: 'http://localhost:8080/open-callback',
} as const;

const ALLOWED_USER = {
  sub: 'allowed-user',
  email: 'allowed@example.com',
  password: 'allowed-password',
  role: 'user',
} as const;
const EMAIL_USER = {
  sub: 'email-user',
  email: 'Email.User@Example.com',
  password: 'email-user-password',
  role: 'user',
} as const;
const OTHER_USER = {
  sub: 'other-user',
  email: 'other@example.com',
  password: 'other-user-password',
  role: 'user',
} as const;
const ADMIN_USER = {
  sub: 'admin-user',
  email: 'admin@example.com',
  password: 'admin-user-password',
  role: 'admin',
} as const;

const RESTRICTED_ACCESS: ClientAccessConfig = {
  users: [ALLOWED_USER.sub],
  emails: ['email.user@example.com'],
  roles: [],
};

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

function clientConfig(client: typeof RESTRICTED | typeof OPEN) {
  return {
    id: client.clientId,
    name: client.clientId,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uris: [client.redirectUri],
    response_types: ['code'],
    grant_types: [
      'authorization_code',
      'refresh_token',
      'urn:ietf:params:oauth:grant-type:device_code',
    ],
    scope: SCOPE,
    skip_consent: true,
  };
}

function restrictedClient() {
  const client = services.config.clients.find(
    (candidate) => candidate.client_id === RESTRICTED.clientId,
  );
  if (!client) throw new Error('restricted client missing');
  return client;
}

beforeAll(async () => {
  ({ app, services, cleanup } = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [ALLOWED_USER, EMAIL_USER, OTHER_USER, ADMIN_USER],
    clients: [
      { ...clientConfig(RESTRICTED), access: RESTRICTED_ACCESS },
      clientConfig(OPEN),
    ],
  }));
});

afterAll(async () => {
  await cleanup();
});

async function login(user: { email: string; password: string }) {
  return createAuthenticatedSession(app, user.email, user.password);
}

async function authorize(
  sessionCookie: string,
  client: typeof RESTRICTED | typeof OPEN = RESTRICTED,
) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    scope: SCOPE,
    state: 'access-state',
    code_challenge: TEST_PKCE.codeChallenge,
    code_challenge_method: TEST_PKCE.codeChallengeMethod,
  });
  const res = await app.request(`/oauth/authorize?${params.toString()}`, {
    headers: { Cookie: `session=${sessionCookie}` },
  });
  expect(res.status).toBe(302);
  return new URL(res.headers.get('location') ?? '', 'http://localhost');
}

async function authorizeCode(
  sessionCookie: string,
  client: typeof RESTRICTED | typeof OPEN = RESTRICTED,
) {
  const location = await authorize(sessionCookie, client);
  const code = location.searchParams.get('code');
  if (!code) throw new Error(`No code in ${location.toString()}`);
  return code;
}

async function postForm(path: string, fields: Array<[string, string]>) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });
}

function clientAuthFields(
  client: typeof RESTRICTED | typeof OPEN = RESTRICTED,
): Array<[string, string]> {
  return [
    ['client_id', client.clientId],
    ['client_secret', client.clientSecret],
  ];
}

async function exchangeCode(code: string) {
  return postForm('/oauth/token', [
    ['grant_type', 'authorization_code'],
    ['code', code],
    ['redirect_uri', RESTRICTED.redirectUri],
    ['code_verifier', TEST_PKCE.codeVerifier],
    ...clientAuthFields(),
  ]);
}

async function refresh(refreshToken: string) {
  return postForm('/oauth/token', [
    ['grant_type', 'refresh_token'],
    ['refresh_token', refreshToken],
    ...clientAuthFields(),
  ]);
}

async function jsonBody(res: Response): Promise<Record<string, unknown>> {
  const body: unknown = await res.json();
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Expected a JSON object');
  }
  return Object.fromEntries(Object.entries(body));
}

async function refreshTokenOf(res: Response): Promise<string> {
  expect(res.status).toBe(200);
  const body = await jsonBody(res);
  const token = body['refresh_token'];
  if (typeof token !== 'string') throw new Error('No refresh token');
  return token;
}

function expectAccessDenied(location: URL) {
  expect(`${location.origin}${location.pathname}`).toBe(RESTRICTED.redirectUri);
  expect(location.searchParams.get('error')).toBe('access_denied');
  expect(location.searchParams.get('state')).toBe('access-state');
  expect(location.searchParams.get('code')).toBeNull();
}

async function withAccess<T>(
  access: ClientAccessConfig | undefined,
  run: () => Promise<T>,
): Promise<T> {
  const client = restrictedClient();
  const previous = client.access;
  if (access) client.access = access;
  else delete client.access;
  try {
    return await run();
  } finally {
    if (previous) client.access = previous;
    else delete client.access;
  }
}

describe('client access policy', () => {
  describe('configuration', () => {
    test('rejects an access block that lists nobody', () => {
      const result = IssuaryRuntimeConfigSchema.safeParse({
        ...MINIMAL_TEST_CONFIG,
        clients: [
          {
            ...clientConfig(RESTRICTED),
            access: { users: [], emails: [], roles: [] },
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    test('rejects unknown access keys', () => {
      const result = IssuaryRuntimeConfigSchema.safeParse({
        ...MINIMAL_TEST_CONFIG,
        clients: [
          {
            ...clientConfig(RESTRICTED),
            access: { users: ['a'], groups: ['b'] },
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('authorization endpoint', () => {
    test('issues a code to a user listed by sub', async () => {
      const sessionCookie = await login(ALLOWED_USER);
      const res = await exchangeCode(await authorizeCode(sessionCookie));
      expect(res.status).toBe(200);
    });

    test('matches a verified email case-insensitively', async () => {
      const sessionCookie = await login(EMAIL_USER);
      const res = await exchangeCode(await authorizeCode(sessionCookie));
      expect(res.status).toBe(200);
    });

    test('redirects an unlisted user back with access_denied', async () => {
      const sessionCookie = await login(OTHER_USER);
      expectAccessDenied(await authorize(sessionCookie));
    });

    test('does not let the admin role bypass the policy', async () => {
      const sessionCookie = await login(ADMIN_USER);
      expectAccessDenied(await authorize(sessionCookie));
    });

    test('allows users matching a listed role', async () => {
      await withAccess(
        { users: [], emails: [], roles: ['admin'] },
        async () => {
          expect(
            (await authorize(await login(ADMIN_USER))).searchParams.get('code'),
          ).not.toBeNull();
          expectAccessDenied(await authorize(await login(ALLOWED_USER)));
        },
      );
    });

    test('ignores an unverified email', async () => {
      const sessionCookie = await login(EMAIL_USER);
      await services.mikro.em.fork().nativeUpdate(
        UserEntitySchema,
        { sub: EMAIL_USER.sub },
        {
          email_verified: false,
        },
      );
      try {
        expectAccessDenied(await authorize(sessionCookie));
      } finally {
        await services.mikro.em.fork().nativeUpdate(
          UserEntitySchema,
          { sub: EMAIL_USER.sub },
          {
            email_verified: true,
          },
        );
      }
    });

    test('leaves clients without access open to every user', async () => {
      const sessionCookie = await login(OTHER_USER);
      const location = await authorize(sessionCookie, OPEN);
      expect(location.searchParams.get('code')).not.toBeNull();
    });
  });

  describe('token endpoint', () => {
    test('rejects a code whose user was removed after issuance', async () => {
      const code = await authorizeCode(await login(ALLOWED_USER));
      await withAccess(
        { users: ['someone-else'], emails: [], roles: [] },
        async () => {
          const res = await exchangeCode(code);
          expect(res.status).toBe(400);
          expect(await jsonBody(res)).toMatchObject({ error: 'invalid_grant' });
        },
      );
    });

    test('stops refreshing once the user is removed from the policy', async () => {
      const code = await authorizeCode(await login(ALLOWED_USER));
      const refreshToken = await refreshTokenOf(await exchangeCode(code));
      const rotated = await refreshTokenOf(await refresh(refreshToken));
      await withAccess(
        { users: ['someone-else'], emails: [], roles: [] },
        async () => {
          const res = await refresh(rotated);
          expect(res.status).toBe(400);
          expect(await jsonBody(res)).toMatchObject({ error: 'invalid_grant' });
        },
      );
    });
  });

  describe('device authorization grant', () => {
    async function deviceCode() {
      const res = await postForm('/oauth/device_authorization', [
        ['scope', 'openid'],
        ...clientAuthFields(),
      ]);
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      const userCode = body['user_code'];
      const device = body['device_code'];
      if (typeof userCode !== 'string' || typeof device !== 'string') {
        throw new Error('Missing device codes');
      }
      return { userCode, deviceCode: device };
    }

    async function approve(sessionCookie: string, userCode: string) {
      return app.request('/oauth/device', {
        method: 'POST',
        headers: {
          Cookie: `session=${sessionCookie}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: services.config.server.public_origin,
        },
        body: new URLSearchParams({
          user_code: userCode,
          decision: 'approve',
        }).toString(),
      });
    }

    async function pollDevice(code: string) {
      return postForm('/oauth/token', [
        ['grant_type', 'urn:ietf:params:oauth:grant-type:device_code'],
        ['device_code', code],
        ...clientAuthFields(),
      ]);
    }

    test('refuses approval by an unlisted user', async () => {
      const { userCode } = await deviceCode();
      const res = await approve(await login(OTHER_USER), userCode);
      expect(res.status).toBe(400);
      expect(await jsonBody(res)).toMatchObject({ error: 'access_denied' });
    });

    test('denies the token when the approver was removed before polling', async () => {
      const codes = await deviceCode();
      const approval = await approve(await login(ALLOWED_USER), codes.userCode);
      expect(approval.status).toBe(200);
      await withAccess(
        { users: ['someone-else'], emails: [], roles: [] },
        async () => {
          const res = await pollDevice(codes.deviceCode);
          expect(res.status).toBe(400);
          expect(await jsonBody(res)).toMatchObject({ error: 'access_denied' });
        },
      );
    });
  });
});

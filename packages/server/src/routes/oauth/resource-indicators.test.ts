import * as jose from 'jose';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { OAuthCodeEntitySchema } from '../../entities/oauth-code.entity.ts';
import { OAuthGrantEntitySchema } from '../../entities/oauth-grant.entity.ts';
import type { AppType } from '../../entrypoints/app.ts';
import type { ServiceContainer } from '../../services/container.ts';
import {
  createAuthenticatedSession,
  createTestApp,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '../../test-utils/index.ts';

/**
 * RFC 8707 Resource Indicators.
 *
 * Covers resource validation at the authorization, token, refresh,
 * client_credentials and device endpoints, and the access token `aud`
 * mapping (one resource -> many audiences).
 */

const MCP_RESOURCE = 'https://mcp.example.test/mcp';
const API_RESOURCE = 'https://api.example.test/v1';
const UNASSIGNED_RESOURCE = 'https://admin.example.test/';
const SCOPE = 'openid profile email offline_access';
const IMPLICIT_CLIENT_ID = 'resource-implicit-client';
const IMPLICIT_REDIRECT_URI = 'http://localhost:8080/implicit-callback';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;
let sessionCookie: string;

beforeAll(async () => {
  ({ app, services, cleanup } = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    resources: [
      { identifier: MCP_RESOURCE, audiences: [MCP_RESOURCE, 'nextcloud'] },
      { identifier: API_RESOURCE },
      { identifier: UNASSIGNED_RESOURCE },
    ],
    clients: [
      {
        ...TEST_OAUTH_CLIENT_CONFIG,
        grant_types: [
          'authorization_code',
          'refresh_token',
          'client_credentials',
          'urn:ietf:params:oauth:grant-type:device_code',
        ],
        scope: `${SCOPE} api.read`,
        skip_consent: true,
        resources: [MCP_RESOURCE, API_RESOURCE],
      },
      {
        id: 'resource-implicit-client',
        name: 'Implicit Client',
        client_id: IMPLICIT_CLIENT_ID,
        redirect_uris: [IMPLICIT_REDIRECT_URI],
        response_types: ['id_token'],
        grant_types: ['implicit'],
        scope: 'openid',
        skip_consent: true,
        resources: [MCP_RESOURCE],
      },
    ],
  }));
  sessionCookie = await createAuthenticatedSession(app);
});

afterAll(async () => {
  await cleanup();
});

function authorizeUrl(resources: string[], extra: Record<string, string> = {}) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: TEST_OAUTH_CLIENT.clientId,
    redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
    scope: SCOPE,
    state: 'resource-state',
    code_challenge: TEST_PKCE.codeChallenge,
    code_challenge_method: TEST_PKCE.codeChallengeMethod,
    ...extra,
  });
  for (const resource of resources) params.append('resource', resource);
  return `/oauth/authorize?${params.toString()}`;
}

async function authorize(resources: string[], cookie = sessionCookie) {
  const res = await app.request(authorizeUrl(resources), {
    headers: { Cookie: `session=${cookie}` },
  });
  expect(res.status).toBe(302);
  return new URL(res.headers.get('location') ?? '', 'http://localhost');
}

async function authorizeCode(resources: string[]): Promise<string> {
  const location = await authorize(resources);
  const code = location.searchParams.get('code');
  if (!code) throw new Error(`No code in ${location.toString()}`);
  return code;
}

async function postForm(
  path: string,
  fields: Array<[string, string]>,
): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });
}

function clientAuthFields(): Array<[string, string]> {
  return [
    ['client_id', TEST_OAUTH_CLIENT.clientId],
    ['client_secret', TEST_OAUTH_CLIENT.clientSecret],
  ];
}

function resourceFields(resources: string[]): Array<[string, string]> {
  return resources.map((resource) => ['resource', resource]);
}

async function exchangeCode(code: string, resources: string[] = []) {
  return postForm('/oauth/token', [
    ['grant_type', 'authorization_code'],
    ['code', code],
    ['redirect_uri', TEST_OAUTH_CLIENT.redirectUri],
    ['code_verifier', TEST_PKCE.codeVerifier],
    ...clientAuthFields(),
    ...resourceFields(resources),
  ]);
}

async function refresh(refreshToken: string, resources: string[] = []) {
  return postForm('/oauth/token', [
    ['grant_type', 'refresh_token'],
    ['refresh_token', refreshToken],
    ...clientAuthFields(),
    ...resourceFields(resources),
  ]);
}

interface TokenBody {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
}

async function tokenBody(res: Response): Promise<TokenBody> {
  const text = await res.text();
  expect(res.status, text).toBe(200);
  const body: unknown = JSON.parse(text);
  if (
    typeof body !== 'object' ||
    body === null ||
    !('access_token' in body) ||
    typeof body.access_token !== 'string'
  ) {
    throw new Error(`Unexpected token response: ${text}`);
  }
  return {
    access_token: body.access_token,
    ...('refresh_token' in body && typeof body.refresh_token === 'string'
      ? { refresh_token: body.refresh_token }
      : {}),
    ...('id_token' in body && typeof body.id_token === 'string'
      ? { id_token: body.id_token }
      : {}),
  };
}

async function expectInvalidTarget(res: Response) {
  expect(res.status).toBe(400);
  const body: unknown = await res.json();
  expect(body).toMatchObject({ error: 'invalid_target' });
}

function audienceOf(token: string) {
  return jose.decodeJwt(token).aud;
}

function expectInvalidTargetRedirect(location: URL) {
  expect(`${location.origin}${location.pathname}`).toBe(
    TEST_OAUTH_CLIENT.redirectUri,
  );
  expect(location.searchParams.get('error')).toBe('invalid_target');
  expect(location.searchParams.get('state')).toBe('resource-state');
  expect(location.searchParams.get('code')).toBeNull();
}

async function issueTokens(
  authorizeResources: string[],
  tokenResources: string[] = [],
) {
  const code = await authorizeCode(authorizeResources);
  return tokenBody(await exchangeCode(code, tokenResources));
}

describe('RFC 8707 resource indicators', () => {
  describe('authorization endpoint', () => {
    test('requests without resource keep the default public_origin audience', async () => {
      const tokens = await issueTokens([]);
      expect(audienceOf(tokens.access_token)).toBe(
        services.config.server.public_origin,
      );
      expect(jose.decodeJwt(tokens.id_token ?? '').aud).toBe(
        TEST_OAUTH_CLIENT.clientId,
      );
    });

    test('one resource maps to all configured audiences as an array', async () => {
      const tokens = await issueTokens([MCP_RESOURCE]);
      expect(audienceOf(tokens.access_token)).toEqual([
        MCP_RESOURCE,
        'nextcloud',
      ]);
      // RFC 8707 does not change the ID token audience (OIDC Core §2).
      expect(jose.decodeJwt(tokens.id_token ?? '').aud).toBe(
        TEST_OAUTH_CLIENT.clientId,
      );
    });

    test('a resource without audiences uses its identifier as a string aud', async () => {
      const tokens = await issueTokens([API_RESOURCE]);
      expect(audienceOf(tokens.access_token)).toBe(API_RESOURCE);
    });

    test('multiple resources produce a de-duplicated, ordered audience union', async () => {
      const tokens = await issueTokens([API_RESOURCE, MCP_RESOURCE]);
      expect(audienceOf(tokens.access_token)).toEqual([
        API_RESOURCE,
        MCP_RESOURCE,
        'nextcloud',
      ]);
    });

    test('stores approved resources on the authorization code', async () => {
      await authorizeCode([MCP_RESOURCE, API_RESOURCE]);
      const [latest] = await services.mikro.em
        .fork()
        .find(
          OAuthCodeEntitySchema,
          {},
          { orderBy: { created_at: 'desc' }, limit: 1 },
        );
      expect(latest).toMatchObject({
        resources: [MCP_RESOURCE, API_RESOURCE],
      });
    });

    test.each([
      ['undefined resource', ['https://unknown.example.test/']],
      ['defined but not allowed for the client', [UNASSIGNED_RESOURCE]],
      ['relative URI', ['/mcp']],
      ['URI with fragment', [`${MCP_RESOURCE}#frag`]],
      ['URI with whitespace', [`${MCP_RESOURCE} ${API_RESOURCE}`]],
      ['empty value', ['']],
      ['one valid and one invalid value', [MCP_RESOURCE, UNASSIGNED_RESOURCE]],
    ])(
      'rejects %s with an invalid_target redirect',
      async (_name, resources) => {
        expectInvalidTargetRedirect(await authorize(resources));
      },
    );

    test('rejects resource indicators for the implicit id_token flow', async () => {
      const params = new URLSearchParams({
        response_type: 'id_token',
        client_id: IMPLICIT_CLIENT_ID,
        redirect_uri: IMPLICIT_REDIRECT_URI,
        scope: 'openid',
        nonce: 'nonce-1',
        state: 'resource-state',
        resource: MCP_RESOURCE,
      });
      const res = await app.request(`/oauth/authorize?${params.toString()}`, {
        headers: { Cookie: `session=${sessionCookie}` },
      });
      expect(res.status).toBe(302);
      const location = new URL(res.headers.get('location') ?? '');
      const fragment = new URLSearchParams(location.hash.slice(1));
      expect(fragment.get('error')).toBe('invalid_target');
      expect(fragment.get('id_token')).toBeNull();
    });

    test('preserves repeated resources through the login and consent continuations', async () => {
      const unauthenticated = await app.request(
        authorizeUrl([MCP_RESOURCE, API_RESOURCE]),
      );
      expect(unauthenticated.status).toBe(302);
      const login = new URL(
        unauthenticated.headers.get('location') ?? '',
        'http://localhost',
      );
      expect(login.pathname).toBe('/login');
      expect(login.searchParams.get('resource')).toBe(
        `${MCP_RESOURCE} ${API_RESOURCE}`,
      );

      const consent = await app.request('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
          'Sec-Fetch-Site': 'same-origin',
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: SCOPE,
          resource: `${MCP_RESOURCE} ${API_RESOURCE}`,
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: TEST_PKCE.codeChallengeMethod,
          decision: 'allow',
        }),
      });
      expect(consent.status).toBe(200);
      const consentBody: unknown = await consent.json();
      if (
        typeof consentBody !== 'object' ||
        consentBody === null ||
        !('redirect_url' in consentBody) ||
        typeof consentBody.redirect_url !== 'string'
      ) {
        throw new Error('Missing redirect_url');
      }
      const continuation = new URL(consentBody.redirect_url);
      expect(continuation.pathname).toBe('/oauth/authorize');
      expect(continuation.searchParams.getAll('resource')).toEqual([
        MCP_RESOURCE,
        API_RESOURCE,
      ]);
    });

    test('consent API rejects resources that are not allowed', async () => {
      const consent = await app.request('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
          'Sec-Fetch-Site': 'same-origin',
        },
        body: JSON.stringify({
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: SCOPE,
          resource: UNASSIGNED_RESOURCE,
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: TEST_PKCE.codeChallengeMethod,
          decision: 'allow',
        }),
      });
      expect(consent.status).toBe(400);
      expect(await consent.json()).toMatchObject({ code: 'INVALID_TARGET' });
    });
  });

  describe('token endpoint (authorization_code)', () => {
    test('narrows the audience to a subset of the approved resources', async () => {
      const tokens = await issueTokens(
        [MCP_RESOURCE, API_RESOURCE],
        [API_RESOURCE],
      );
      expect(audienceOf(tokens.access_token)).toBe(API_RESOURCE);
    });

    test('rejects resources that were not approved at authorization', async () => {
      const code = await authorizeCode([API_RESOURCE]);
      await expectInvalidTarget(await exchangeCode(code, [MCP_RESOURCE]));
    });

    test('rejects resources when the authorization request had none', async () => {
      const code = await authorizeCode([]);
      await expectInvalidTarget(await exchangeCode(code, [API_RESOURCE]));
    });

    test('a rejected resource does not consume the authorization code', async () => {
      const code = await authorizeCode([API_RESOURCE]);
      await expectInvalidTarget(await exchangeCode(code, [MCP_RESOURCE]));
      const tokens = await tokenBody(await exchangeCode(code));
      expect(audienceOf(tokens.access_token)).toBe(API_RESOURCE);
    });

    test('resource-bound access tokens work at userinfo and introspection', async () => {
      const tokens = await issueTokens([MCP_RESOURCE]);
      const userinfo = await app.request('/oauth/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      expect(userinfo.status).toBe(200);
      expect(await userinfo.json()).toMatchObject({
        sub: TEST_USER_CONFIG.sub,
      });

      const introspection = await postForm('/oauth/introspect', [
        ['token', tokens.access_token],
        ...clientAuthFields(),
      ]);
      expect(introspection.status).toBe(200);
      expect(await introspection.json()).toMatchObject({
        active: true,
        aud: [MCP_RESOURCE, 'nextcloud'],
      });
    });

    test('introspection keeps a string aud for tokens without resources', async () => {
      const tokens = await issueTokens([]);
      const introspection = await postForm('/oauth/introspect', [
        ['token', tokens.access_token],
        ...clientAuthFields(),
      ]);
      expect(await introspection.json()).toMatchObject({
        active: true,
        aud: services.config.server.public_origin,
      });
    });
  });

  describe('refresh_token grant', () => {
    test('stores the approved resources on the grant', async () => {
      const tokens = await issueTokens(
        [MCP_RESOURCE, API_RESOURCE],
        [API_RESOURCE],
      );
      const grantId = jose.decodeJwt(tokens.access_token)['grant_id'];
      expect(typeof grantId).toBe('string');
      const grant = await services.mikro.em
        .fork()
        .findOneOrFail(OAuthGrantEntitySchema, { id: String(grantId) });
      expect(grant.resources).toEqual([MCP_RESOURCE, API_RESOURCE]);
    });

    test('omitting resource on refresh issues the full approved audience', async () => {
      const tokens = await issueTokens(
        [MCP_RESOURCE, API_RESOURCE],
        [API_RESOURCE],
      );
      const refreshed = await tokenBody(
        await refresh(tokens.refresh_token ?? ''),
      );
      expect(audienceOf(refreshed.access_token)).toEqual([
        MCP_RESOURCE,
        'nextcloud',
        API_RESOURCE,
      ]);
    });

    test('downscopes to a subset without shrinking the grant', async () => {
      const tokens = await issueTokens([MCP_RESOURCE, API_RESOURCE]);
      const downscoped = await tokenBody(
        await refresh(tokens.refresh_token ?? '', [MCP_RESOURCE]),
      );
      expect(audienceOf(downscoped.access_token)).toEqual([
        MCP_RESOURCE,
        'nextcloud',
      ]);

      const full = await tokenBody(
        await refresh(downscoped.refresh_token ?? '', [API_RESOURCE]),
      );
      expect(audienceOf(full.access_token)).toBe(API_RESOURCE);
    });

    test('rejects resources outside the approved grant', async () => {
      const tokens = await issueTokens([API_RESOURCE]);
      await expectInvalidTarget(
        await refresh(tokens.refresh_token ?? '', [MCP_RESOURCE]),
      );
      // The rejected request must not rotate (consume) the refresh token.
      const refreshed = await tokenBody(
        await refresh(tokens.refresh_token ?? ''),
      );
      expect(audienceOf(refreshed.access_token)).toBe(API_RESOURCE);
    });

    test('grants without resources keep the default audience on refresh', async () => {
      const tokens = await issueTokens([]);
      const refreshed = await tokenBody(
        await refresh(tokens.refresh_token ?? ''),
      );
      expect(audienceOf(refreshed.access_token)).toBe(
        services.config.server.public_origin,
      );
      await expectInvalidTarget(
        await refresh(refreshed.refresh_token ?? '', [API_RESOURCE]),
      );
    });
  });

  describe('client_credentials grant', () => {
    async function clientCredentials(resources: string[]) {
      return postForm('/oauth/token', [
        ['grant_type', 'client_credentials'],
        ['scope', 'api.read'],
        ...clientAuthFields(),
        ...resourceFields(resources),
      ]);
    }

    test('uses the audiences of the requested resources', async () => {
      const tokens = await tokenBody(
        await clientCredentials([MCP_RESOURCE, API_RESOURCE]),
      );
      expect(audienceOf(tokens.access_token)).toEqual([
        MCP_RESOURCE,
        'nextcloud',
        API_RESOURCE,
      ]);
    });

    test('keeps the default audience without resource', async () => {
      const tokens = await tokenBody(await clientCredentials([]));
      expect(audienceOf(tokens.access_token)).toBe(
        services.config.server.public_origin,
      );
    });

    test('rejects resources not allowed for the client', async () => {
      await expectInvalidTarget(await clientCredentials([UNASSIGNED_RESOURCE]));
    });
  });

  describe('device authorization grant', () => {
    test('rejects resource at the device authorization endpoint', async () => {
      await expectInvalidTarget(
        await postForm('/oauth/device_authorization', [
          ['scope', 'openid'],
          ...clientAuthFields(),
          ['resource', API_RESOURCE],
        ]),
      );
    });

    test('rejects resource at the token endpoint for device_code', async () => {
      await expectInvalidTarget(
        await postForm('/oauth/token', [
          ['grant_type', 'urn:ietf:params:oauth:grant-type:device_code'],
          ['device_code', 'unknown-device-code'],
          ...clientAuthFields(),
          ['resource', API_RESOURCE],
        ]),
      );
    });
  });
});

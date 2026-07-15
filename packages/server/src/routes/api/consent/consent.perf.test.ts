import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '../../../test-utils/index.js';
import {
  deferPerfResponseValidation,
  perfRequestSequenceIndex,
  runHttpPerf,
} from '../../../test-utils/perf/index.js';

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [TEST_OAUTH_CLIENT_CONFIG],
  });
  app = server.app;
  client = testClient(app);
  cleanup = server.cleanup;
});

afterEach(async () => {
  await cleanup();
});

async function requestConsentInfo(sessionCookie: string) {
  const response = await client.api.consent.$get(
    {
      query: {
        client_id: TEST_OAUTH_CLIENT.clientId,
        scope: 'openid profile email',
      },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.client?.clientId).toBe(TEST_OAUTH_CLIENT.clientId);
    expect(body.scopes?.map((scope) => scope.name)).toEqual([
      'openid',
      'profile',
      'email',
    ]);
    expect(body.user?.sub).toBe(TEST_USER_CONFIG.sub);
  });
}

async function requestConsentAllow(sessionCookie: string, state: string) {
  const response = await client.api.consent.$post(
    {
      json: {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
        state,
        code_challenge: TEST_PKCE.codeChallenge,
        code_challenge_method: TEST_PKCE.codeChallengeMethod,
        decision: 'allow',
      },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    const redirectUrl = new URL(body.redirect_url ?? 'http://invalid.local');
    expect(redirectUrl.pathname).toBe('/oauth/authorize');
    expect(redirectUrl.searchParams.get('client_id')).toBe(
      TEST_OAUTH_CLIENT.clientId,
    );
    expect(redirectUrl.searchParams.get('state')).toBe(state);
    expect(redirectUrl.searchParams.get('code_challenge')).toBe(
      TEST_PKCE.codeChallenge,
    );
  });
}

describe('GET /api/consent perf', () => {
  test('handles repeated authenticated consent-info requests through the real route', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    await runHttpPerf({
      name: 'GET /api/consent authenticated smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: async () => requestConsentInfo(sessionCookie),
    });
  });
});

describe('POST /api/consent perf', () => {
  test('handles repeated consent grants through the real route', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    await runHttpPerf({
      name: 'POST /api/consent allow smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: async (context) => {
        const sequenceIndex = perfRequestSequenceIndex(context, 5);
        return requestConsentAllow(
          sessionCookie,
          `consent-perf-${sequenceIndex}`,
        );
      },
    });
  });
});

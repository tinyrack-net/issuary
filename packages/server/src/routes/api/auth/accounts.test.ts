import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../entrypoints/app.ts';
import type { ServiceContainer } from '../../../services/container.ts';
import {
  assertJsonBody,
  createTestApp,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../test-utils/index.ts';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    auth: {
      account_selection: {
        enabled: true,
        mode: 'smart',
      },
    },
    users: [TEST_USER_CONFIG],
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function createPasswordUser(
  email = generateUniqueEmail('account-select'),
) {
  const password = 'testPassword123';
  let sub = '';
  await withMikroContext(services, async () => {
    const passwordHash = await services.securityService.hashPassword(password);
    const user = services.mikro.user.create({
      email,
      password_hash: passwordHash,
    });
    user.email_verified = true;
    await services.mikro.em.persist(user).flush();
    sub = user.sub;
  });
  return { email, password, sub };
}

async function createTwoAccountSession() {
  const client = testClient(app);
  const secondUser = await createPasswordUser();
  const firstLogin = await client.api.auth.login.$post({
    json: { email: TEST_USER.email, password: TEST_USER.password },
  });
  const firstCookie = extractCookie(firstLogin, 'session');
  const secondLogin = await client.api.auth.login.$post(
    { json: { email: secondUser.email, password: secondUser.password } },
    { headers: { Cookie: `session=${firstCookie}` } },
  );
  const sessionCookie = extractCookie(secondLogin, 'session');
  return { client, sessionCookie, secondUser };
}

describe('remembered account APIs', () => {
  test('lists remembered accounts without exposing unrelated users', async () => {
    const { client, sessionCookie, secondUser } =
      await createTwoAccountSession();
    await createPasswordUser(generateUniqueEmail('not-remembered'));

    const res = await client.api.auth.accounts.$get(
      { query: {} },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(res.status).toBe(200);
    const body = await assertJsonBody(res);
    expect(body.active_sub).toBe(secondUser.sub);
    expect(body.allow_add_account).toBe(true);
    expect(body.allow_remove_account).toBe(true);
    expect(body.accounts.map((account) => account.sub)).toEqual([
      TEST_USER_CONFIG.sub,
      secondUser.sub,
    ]);
    expect(body.accounts.map((account) => account.email)).toEqual([
      TEST_USER.email,
      secondUser.email,
    ]);
    expect(body.accounts.map((account) => account.current)).toEqual([
      false,
      true,
    ]);
  });

  test('selects a remembered account as the active session user', async () => {
    const { client, sessionCookie } = await createTwoAccountSession();

    const selectRes = await client.api.auth.accounts.select.$post(
      { json: { sub: TEST_USER_CONFIG.sub } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(selectRes.status).toBe(200);
    const selectedCookie = extractCookie(selectRes, 'session');
    const sessionRes = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${selectedCookie}` } },
    );
    const sessionBody = await assertJsonBody(sessionRes);
    expect(sessionBody.user?.sub).toBe(TEST_USER_CONFIG.sub);
  });

  test('rejects selecting an account that is not remembered', async () => {
    const { client, sessionCookie } = await createTwoAccountSession();

    const selectRes = await client.api.auth.accounts.select.$post(
      { json: { sub: 'not-remembered' } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    expect(selectRes.status).toBe(400);
  });

  test('applies client-level allow_add_account override when listing accounts for a client', async () => {
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        account_selection: {
          enabled: true,
          allow_add_account: true,
        },
      },
      clients: [
        {
          ...TEST_OAUTH_CLIENT_CONFIG,
          account_selection: {
            allow_add_account: false,
          },
        },
      ],
      users: [TEST_USER_CONFIG],
    });
    try {
      const scopedClient = testClient(scopedServer.app);
      const login = await scopedClient.api.auth.login.$post({
        json: { email: TEST_USER.email, password: TEST_USER.password },
      });
      const cookie = extractCookie(login, 'session');

      const res = await scopedClient.api.auth.accounts.$get(
        { query: { client_id: TEST_OAUTH_CLIENT.clientId } },
        { headers: { Cookie: `session=${cookie}` } },
      );

      const body = await assertJsonBody(res);
      expect(body.allow_add_account).toBe(false);
      expect(body.allow_remove_account).toBe(true);
    } finally {
      await scopedServer.cleanup();
    }
  });

  test('removes non-active accounts but not the active account', async () => {
    const { client, sessionCookie, secondUser } =
      await createTwoAccountSession();

    const removeActiveRes = await client.api.auth.accounts.remove.$post(
      { json: { sub: secondUser.sub } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(removeActiveRes.status).toBe(400);

    const removeOldRes = await client.api.auth.accounts.remove.$post(
      { json: { sub: TEST_USER_CONFIG.sub } },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(removeOldRes.status).toBe(200);
    const removedCookie = extractCookie(removeOldRes, 'session');

    const listRes = await client.api.auth.accounts.$get(
      { query: {} },
      { headers: { Cookie: `session=${removedCookie}` } },
    );
    const body = await assertJsonBody(listRes);
    expect(body.accounts.map((account) => account.sub)).toEqual([
      secondUser.sub,
    ]);
  });
});

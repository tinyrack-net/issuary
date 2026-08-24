import { testClient } from 'hono/testing';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import type { AppType } from '../../../entrypoints/app.ts';
import type { IssuaryRuntimeConfigInput } from '../../../lib/config/index.ts';
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

type TestClientConfig = NonNullable<
  IssuaryRuntimeConfigInput['clients']
>[number];

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

afterEach(() => {
  vi.useRealTimers();
});

async function createPasswordUser(
  email = generateUniqueEmail('account-select'),
  targetServices = services,
) {
  const password = 'testPassword123';
  let sub = '';
  await withMikroContext(targetServices, async () => {
    const passwordHash =
      await targetServices.securityService.hashPassword(password);
    const user = targetServices.mikro.user.create({
      email,
      password_hash: passwordHash,
    });
    user.email_verified = true;
    await targetServices.mikro.em.persist(user).flush();
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

  test('lists active user but no remembered roster when account remembering is disabled', async () => {
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        account_selection: {
          enabled: true,
          mode: 'smart',
          allow_add_account: true,
          allow_remove_account: true,
          remember_accounts: {
            enabled: false,
          },
        },
      },
      users: [TEST_USER_CONFIG],
    });
    try {
      const scopedClient = testClient(scopedServer.app);
      const login = await scopedClient.api.auth.login.$post({
        json: { email: TEST_USER.email, password: TEST_USER.password },
      });
      const cookie = extractCookie(login, 'session');

      const res = await scopedClient.api.auth.accounts.$get(
        { query: {} },
        { headers: { Cookie: `session=${cookie}` } },
      );

      const body = await assertJsonBody(res);
      expect(body.active_sub).toBe(TEST_USER_CONFIG.sub);
      expect(body.allow_add_account).toBe(true);
      expect(body.allow_remove_account).toBe(true);
      expect(body.accounts).toEqual([]);
    } finally {
      await scopedServer.cleanup();
    }
  });

  test('rejects selecting stale remembered accounts when account remembering is disabled', async () => {
    const rememberServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        account_selection: {
          enabled: true,
          mode: 'smart',
          remember_accounts: {
            enabled: true,
          },
        },
      },
      users: [TEST_USER_CONFIG],
    });
    const disabledServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        account_selection: {
          enabled: true,
          mode: 'smart',
          remember_accounts: {
            enabled: false,
          },
        },
      },
      users: [TEST_USER_CONFIG],
    });
    try {
      const rememberClient = testClient(rememberServer.app);
      const login = await rememberClient.api.auth.login.$post({
        json: { email: TEST_USER.email, password: TEST_USER.password },
      });
      const staleCookie = extractCookie(login, 'session');
      const disabledClient = testClient(disabledServer.app);

      const selectRes = await disabledClient.api.auth.accounts.select.$post(
        { json: { sub: TEST_USER_CONFIG.sub } },
        { headers: { Cookie: `session=${staleCookie}` } },
      );

      expect(selectRes.status).toBe(400);
      await expect(selectRes.json()).resolves.toMatchObject({
        code: 'ACCOUNT_NOT_REMEMBERED',
      });
    } finally {
      await rememberServer.cleanup();
      await disabledServer.cleanup();
    }
  });

  test('applies remembered account cap before listing and rejects active account removal at the cap edge', async () => {
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        account_selection: {
          enabled: true,
          mode: 'smart',
          allow_remove_account: true,
          remember_accounts: {
            enabled: true,
            max_accounts: 2,
          },
        },
      },
      users: [TEST_USER_CONFIG],
    });
    try {
      const scopedClient = testClient(scopedServer.app);
      const secondUser = await createPasswordUser(
        undefined,
        scopedServer.services,
      );
      const thirdUser = await createPasswordUser(
        undefined,
        scopedServer.services,
      );
      const firstLogin = await scopedClient.api.auth.login.$post({
        json: { email: TEST_USER.email, password: TEST_USER.password },
      });
      const firstCookie = extractCookie(firstLogin, 'session');
      const secondLogin = await scopedClient.api.auth.login.$post(
        { json: { email: secondUser.email, password: secondUser.password } },
        { headers: { Cookie: `session=${firstCookie}` } },
      );
      const secondCookie = extractCookie(secondLogin, 'session');
      const thirdLogin = await scopedClient.api.auth.login.$post(
        { json: { email: thirdUser.email, password: thirdUser.password } },
        { headers: { Cookie: `session=${secondCookie}` } },
      );
      const sessionCookie = extractCookie(thirdLogin, 'session');

      const listRes = await scopedClient.api.auth.accounts.$get(
        { query: {} },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      const listBody = await assertJsonBody(listRes);
      expect(listBody.active_sub).toBe(thirdUser.sub);
      expect(listBody.accounts.map((account) => account.sub)).toEqual([
        secondUser.sub,
        thirdUser.sub,
      ]);
      expect(listBody.accounts.map((account) => account.current)).toEqual([
        false,
        true,
      ]);

      const removeActiveRes = await scopedClient.api.auth.accounts.remove.$post(
        { json: { sub: thirdUser.sub } },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      expect(removeActiveRes.status).toBe(400);
      await expect(removeActiveRes.json()).resolves.toMatchObject({
        code: 'ACCOUNT_NOT_REMOVABLE',
      });
    } finally {
      await scopedServer.cleanup();
    }
  });

  test('excludes expired remembered accounts from the accounts API', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_700_000_000_000));
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        account_selection: {
          enabled: true,
          mode: 'smart',
          remember_accounts: {
            enabled: true,
            ttl: '1s',
          },
        },
      },
      users: [TEST_USER_CONFIG],
    });
    try {
      const scopedClient = testClient(scopedServer.app);
      const secondUser = await createPasswordUser(
        undefined,
        scopedServer.services,
      );
      const firstLogin = await scopedClient.api.auth.login.$post({
        json: { email: TEST_USER.email, password: TEST_USER.password },
      });
      const firstCookie = extractCookie(firstLogin, 'session');
      vi.setSystemTime(new Date(1_700_000_002_000));
      const secondLogin = await scopedClient.api.auth.login.$post(
        { json: { email: secondUser.email, password: secondUser.password } },
        { headers: { Cookie: `session=${firstCookie}` } },
      );
      const sessionCookie = extractCookie(secondLogin, 'session');

      const listRes = await scopedClient.api.auth.accounts.$get(
        { query: {} },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      const listBody = await assertJsonBody(listRes);
      expect(listBody.active_sub).toBe(secondUser.sub);
      expect(listBody.accounts.map((account) => account.sub)).toEqual([
        secondUser.sub,
      ]);
    } finally {
      await scopedServer.cleanup();
    }
  });

  test('rejects selecting an expired remembered account from stale session data', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_700_000_000_000));
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        account_selection: {
          enabled: true,
          mode: 'smart',
          remember_accounts: {
            enabled: true,
            ttl: '1s',
          },
        },
      },
      users: [TEST_USER_CONFIG],
    });
    try {
      const scopedClient = testClient(scopedServer.app);
      const login = await scopedClient.api.auth.login.$post({
        json: { email: TEST_USER.email, password: TEST_USER.password },
      });
      const staleCookie = extractCookie(login, 'session');
      vi.setSystemTime(new Date(1_700_000_002_000));

      const selectRes = await scopedClient.api.auth.accounts.select.$post(
        { json: { sub: TEST_USER_CONFIG.sub } },
        { headers: { Cookie: `session=${staleCookie}` } },
      );

      expect(selectRes.status).toBe(400);
      await expect(selectRes.json()).resolves.toMatchObject({
        code: 'ACCOUNT_NOT_REMEMBERED',
      });
    } finally {
      await scopedServer.cleanup();
    }
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

  test('applies each requesting client policy without corrupting the shared remembered roster', async () => {
    const restrictedRedirectUri = 'http://localhost:8080/restricted-callback';
    const normalRedirectUri = 'http://localhost:8080/normal-callback';
    const restrictedClient = {
      ...TEST_OAUTH_CLIENT_CONFIG,
      id: 'restricted-account-selection-client-config',
      name: 'Restricted Account Selection Client',
      client_id: 'restricted-account-selection-client',
      redirect_uris: [restrictedRedirectUri],
      account_selection: {
        mode: 'never',
        allow_add_account: false,
      },
    } satisfies TestClientConfig;
    const normalClient = {
      ...TEST_OAUTH_CLIENT_CONFIG,
      id: 'normal-account-selection-client-config',
      name: 'Normal Account Selection Client',
      client_id: 'normal-account-selection-client',
      redirect_uris: [normalRedirectUri],
    } satisfies TestClientConfig;
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        account_selection: {
          enabled: true,
          mode: 'smart',
          allow_add_account: true,
        },
      },
      clients: [restrictedClient, normalClient],
      users: [TEST_USER_CONFIG],
    });

    try {
      const scopedClient = testClient(scopedServer.app);
      const secondUser = await createPasswordUser(
        undefined,
        scopedServer.services,
      );
      const firstLogin = await scopedClient.api.auth.login.$post({
        json: { email: TEST_USER.email, password: TEST_USER.password },
      });
      const firstCookie = extractCookie(firstLogin, 'session');
      const secondLogin = await scopedClient.api.auth.login.$post(
        { json: { email: secondUser.email, password: secondUser.password } },
        { headers: { Cookie: `session=${firstCookie}` } },
      );
      const sessionCookie = extractCookie(secondLogin, 'session');

      const restrictedListRes = await scopedClient.api.auth.accounts.$get(
        { query: { client_id: restrictedClient.client_id } },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      const restrictedList = await assertJsonBody(restrictedListRes);
      expect(restrictedList.allow_add_account).toBe(false);
      expect(restrictedList.accounts.map((account) => account.sub)).toEqual([
        TEST_USER_CONFIG.sub,
        secondUser.sub,
      ]);

      const restrictedAuthorizeRes = await scopedClient.oauth.authorize.$get(
        {
          query: {
            response_type: 'code',
            client_id: restrictedClient.client_id,
            redirect_uri: restrictedRedirectUri,
            scope: 'openid profile email',
            state: 'restricted-client-selection-state',
            code_challenge: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ',
            code_challenge_method: 'S256',
            prompt: 'select_account',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      expect(restrictedAuthorizeRes.status).toBe(302);
      expect(
        new URL(restrictedAuthorizeRes.headers.get('location') ?? '').pathname,
      ).toBe('/login');

      const normalListRes = await scopedClient.api.auth.accounts.$get(
        { query: { client_id: normalClient.client_id } },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      const normalList = await assertJsonBody(normalListRes);
      expect(normalList.allow_add_account).toBe(true);
      expect(normalList.accounts.map((account) => account.sub)).toEqual([
        TEST_USER_CONFIG.sub,
        secondUser.sub,
      ]);

      const normalAuthorizeRes = await scopedClient.oauth.authorize.$get(
        {
          query: {
            response_type: 'code',
            client_id: normalClient.client_id,
            redirect_uri: normalRedirectUri,
            scope: 'openid profile email',
            state: 'normal-client-selection-state',
            code_challenge: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ',
            code_challenge_method: 'S256',
            prompt: 'select_account',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      expect(normalAuthorizeRes.status).toBe(302);
      expect(
        new URL(normalAuthorizeRes.headers.get('location') ?? '').pathname,
      ).toBe('/account/select');
    } finally {
      await scopedServer.cleanup();
    }
  });

  test('returns disabled affordances and no remembered roster when global account selection is disabled', async () => {
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        account_selection: {
          enabled: false,
          allow_add_account: true,
          allow_remove_account: true,
        },
      },
      users: [TEST_USER_CONFIG],
    });
    try {
      const scopedClient = testClient(scopedServer.app);
      const login = await scopedClient.api.auth.login.$post({
        json: { email: TEST_USER.email, password: TEST_USER.password },
      });
      const cookie = extractCookie(login, 'session');

      const res = await scopedClient.api.auth.accounts.$get(
        { query: {} },
        { headers: { Cookie: `session=${cookie}` } },
      );

      const body = await assertJsonBody(res);
      expect(body.allow_add_account).toBe(false);
      expect(body.allow_remove_account).toBe(false);
      expect(body.accounts).toEqual([]);
    } finally {
      await scopedServer.cleanup();
    }
  });

  test('treats mode disabled as disabled policy when listing accounts', async () => {
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        account_selection: {
          enabled: true,
          mode: 'disabled',
          allow_add_account: true,
          allow_remove_account: true,
          remember_accounts: {
            enabled: true,
          },
        },
      },
      users: [TEST_USER_CONFIG],
    });
    try {
      const scopedClient = testClient(scopedServer.app);
      const secondUser = await createPasswordUser(
        undefined,
        scopedServer.services,
      );
      const firstLogin = await scopedClient.api.auth.login.$post({
        json: { email: TEST_USER.email, password: TEST_USER.password },
      });
      const firstCookie = extractCookie(firstLogin, 'session');
      const secondLogin = await scopedClient.api.auth.login.$post(
        { json: { email: secondUser.email, password: secondUser.password } },
        { headers: { Cookie: `session=${firstCookie}` } },
      );
      const sessionCookie = extractCookie(secondLogin, 'session');

      const res = await scopedClient.api.auth.accounts.$get(
        { query: {} },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      expect(body.active_sub).toBe(secondUser.sub);
      expect(body.allow_add_account).toBe(false);
      expect(body.allow_remove_account).toBe(false);
      expect(body.accounts).toEqual([]);
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
    await expect(removeActiveRes.json()).resolves.toMatchObject({
      code: 'ACCOUNT_NOT_REMOVABLE',
    });

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
    expect(body.active_sub).toBe(secondUser.sub);
    expect(body.accounts.map((account) => account.sub)).toEqual([
      secondUser.sub,
    ]);

    const sessionRes = await client.api.user.session.$get(
      {},
      { headers: { Cookie: `session=${removedCookie}` } },
    );
    const sessionBody = await assertJsonBody(sessionRes);
    expect(sessionBody.user?.sub).toBe(secondUser.sub);
  });

  test('rejects account removal when global account selection is disabled', async () => {
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        account_selection: {
          enabled: false,
          allow_remove_account: true,
        },
      },
      users: [TEST_USER_CONFIG],
    });
    try {
      const scopedClient = testClient(scopedServer.app);
      const login = await scopedClient.api.auth.login.$post({
        json: { email: TEST_USER.email, password: TEST_USER.password },
      });
      const cookie = extractCookie(login, 'session');

      const removeRes = await scopedClient.api.auth.accounts.remove.$post(
        { json: { sub: TEST_USER_CONFIG.sub } },
        { headers: { Cookie: `session=${cookie}` } },
      );

      expect(removeRes.status).toBe(400);
      await expect(removeRes.json()).resolves.toMatchObject({
        code: 'ACCOUNT_REMOVAL_DISABLED',
      });
    } finally {
      await scopedServer.cleanup();
    }
  });

  test('rejects account removal when account-selection mode is disabled', async () => {
    const scopedServer = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        account_selection: {
          enabled: true,
          mode: 'disabled',
          allow_remove_account: true,
          remember_accounts: {
            enabled: true,
          },
        },
      },
      users: [TEST_USER_CONFIG],
    });
    try {
      const scopedClient = testClient(scopedServer.app);
      const secondUser = await createPasswordUser(
        undefined,
        scopedServer.services,
      );
      const firstLogin = await scopedClient.api.auth.login.$post({
        json: { email: TEST_USER.email, password: TEST_USER.password },
      });
      const firstCookie = extractCookie(firstLogin, 'session');
      const secondLogin = await scopedClient.api.auth.login.$post(
        { json: { email: secondUser.email, password: secondUser.password } },
        { headers: { Cookie: `session=${firstCookie}` } },
      );
      const sessionCookie = extractCookie(secondLogin, 'session');

      const removeRes = await scopedClient.api.auth.accounts.remove.$post(
        { json: { sub: TEST_USER_CONFIG.sub } },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(removeRes.status).toBe(400);
      await expect(removeRes.json()).resolves.toMatchObject({
        code: 'ACCOUNT_REMOVAL_DISABLED',
      });
    } finally {
      await scopedServer.cleanup();
    }
  });
});

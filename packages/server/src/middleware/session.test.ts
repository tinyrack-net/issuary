import { Hono } from 'hono';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { type SessionEnv, sessionMiddleware } from './session.ts';

const SESSION_SECRET =
  '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b';

function createSessionTestApp(
  isSecure: boolean,
  rememberedAccounts: Parameters<typeof sessionMiddleware>[2] = undefined,
) {
  const app = new Hono<SessionEnv>();
  app.use('*', sessionMiddleware(SESSION_SECRET, isSecure, rememberedAccounts));

  app.post('/seed-transient', (c) => {
    c.var.session.set('oauth', {
      state: 'attacker-state',
      codeVerifier: 'attacker-verifier',
      providerId: 'github',
      mode: 'login',
      returnUrl: '/profile',
    });
    c.var.session.set('passkey_challenge', 'attacker-challenge');
    return c.json({ ok: true });
  });

  app.post('/login', (c) => {
    c.var.session.setUserSession('user-1', 1_700_000_000);
    return c.json({ ok: true });
  });

  app.post('/login/:sub/:authTime', (c) => {
    c.var.session.setUserSession(
      c.req.param('sub'),
      Number(c.req.param('authTime')),
    );
    return c.json({ ok: true });
  });

  app.post('/select/:sub', (c) => {
    const selected = c.var.session.selectUserSession(c.req.param('sub'));
    return c.json({ selected });
  });

  app.post('/remove/:sub', (c) => {
    const removed = c.var.session.removeRememberedUserSession(
      c.req.param('sub'),
    );
    return c.json({ removed });
  });

  app.post('/clear-auth', (c) => {
    c.var.session.clearAuthSessions();
    return c.json({ ok: true });
  });

  app.post('/logout', (c) => {
    c.var.session.delete();
    return c.json({ ok: true });
  });

  app.get('/debug-session', (c) =>
    c.json({
      user: c.var.session.get('user') ?? null,
      accounts: c.var.session.get('accounts') ?? [],
      oauth: c.var.session.get('oauth') ?? null,
      passkey_challenge: c.var.session.get('passkey_challenge') ?? null,
    }),
  );

  return app;
}

function requireSetCookie(res: Response) {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('Expected Set-Cookie header');
  }
  return setCookie;
}

function requireCookiePair(res: Response) {
  const setCookie = requireSetCookie(res);
  const [cookiePair] = setCookie.split(';');
  if (!cookiePair) {
    throw new Error('Expected cookie pair');
  }
  return cookiePair;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('session middleware', () => {
  test('sets authenticated session cookie with secure browser attributes for HTTPS origin', async () => {
    const app = createSessionTestApp(true);

    const res = await app.request('/login', { method: 'POST' });

    expect(res.status).toBe(200);
    const setCookie = requireSetCookie(res);
    expect(setCookie).toContain('session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
  });

  test('uses matching path and expiry semantics when deleting the session cookie', async () => {
    const app = createSessionTestApp(true);
    const loginRes = await app.request('/login', { method: 'POST' });
    const loginCookie = requireCookiePair(loginRes);

    const logoutRes = await app.request('/logout', {
      headers: { Cookie: loginCookie },
      method: 'POST',
    });

    expect(logoutRes.status).toBe(200);
    const deleteCookie = requireSetCookie(logoutRes);
    expect(deleteCookie).toContain('session=');
    expect(deleteCookie).toContain('Path=/');
    expect(deleteCookie).toMatch(/Max-Age=0|Expires=/);
  });

  test('ignores malformed encrypted session cookies safely', async () => {
    const app = createSessionTestApp(true);

    const res = await app.request('/debug-session', {
      headers: { Cookie: 'session=not-a-valid-encrypted-cookie' },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      user: null,
      accounts: [],
      oauth: null,
      passkey_challenge: null,
    });
  });

  test('does not preserve pre-authentication transient session data after login promotion', async () => {
    const app = createSessionTestApp(true);
    const seedRes = await app.request('/seed-transient', { method: 'POST' });
    const seededCookie = requireCookiePair(seedRes);

    const loginRes = await app.request('/login', {
      headers: { Cookie: seededCookie },
      method: 'POST',
    });
    const loginCookie = requireCookiePair(loginRes);

    const debugRes = await app.request('/debug-session', {
      headers: { Cookie: loginCookie },
    });

    expect(debugRes.status).toBe(200);
    await expect(debugRes.json()).resolves.toEqual({
      user: { sub: 'user-1', authenticated_at: 1_700_000_000 },
      accounts: [
        {
          sub: 'user-1',
          authenticated_at: 1_700_000_000,
          last_used_at: 1_700_000_000,
        },
      ],
      oauth: null,
      passkey_challenge: null,
    });
  });

  test('remembers every successfully authenticated account and marks the newest as active', async () => {
    const app = createSessionTestApp(true);
    const firstLogin = await app.request('/login/user-1/1700000000', {
      method: 'POST',
    });
    const firstCookie = requireCookiePair(firstLogin);

    const secondLogin = await app.request('/login/user-2/1700000100', {
      headers: { Cookie: firstCookie },
      method: 'POST',
    });
    const secondCookie = requireCookiePair(secondLogin);

    const debugRes = await app.request('/debug-session', {
      headers: { Cookie: secondCookie },
    });

    await expect(debugRes.json()).resolves.toMatchObject({
      user: { sub: 'user-2', authenticated_at: 1_700_000_100 },
      accounts: [
        {
          sub: 'user-1',
          authenticated_at: 1_700_000_000,
          last_used_at: 1_700_000_000,
        },
        {
          sub: 'user-2',
          authenticated_at: 1_700_000_100,
          last_used_at: 1_700_000_100,
        },
      ],
    });
  });

  test('selects only a remembered account as the active user session', async () => {
    const app = createSessionTestApp(true);
    const firstLogin = await app.request('/login/user-1/1700000000', {
      method: 'POST',
    });
    const firstCookie = requireCookiePair(firstLogin);
    const secondLogin = await app.request('/login/user-2/1700000100', {
      headers: { Cookie: firstCookie },
      method: 'POST',
    });
    const secondCookie = requireCookiePair(secondLogin);

    const selectRes = await app.request('/select/user-1', {
      headers: { Cookie: secondCookie },
      method: 'POST',
    });
    expect(await selectRes.json()).toEqual({ selected: true });
    const selectedCookie = requireCookiePair(selectRes);

    const debugRes = await app.request('/debug-session', {
      headers: { Cookie: selectedCookie },
    });
    await expect(debugRes.json()).resolves.toMatchObject({
      user: { sub: 'user-1', authenticated_at: 1_700_000_000 },
    });

    const forgedRes = await app.request('/select/user-3', {
      headers: { Cookie: selectedCookie },
      method: 'POST',
    });
    expect(await forgedRes.json()).toEqual({ selected: false });
  });

  test('removes non-active remembered accounts but refuses to remove the active account', async () => {
    const app = createSessionTestApp(true);
    let cookie = requireCookiePair(
      await app.request('/login/user-1/1700000000', { method: 'POST' }),
    );
    cookie = requireCookiePair(
      await app.request('/login/user-2/1700000100', {
        headers: { Cookie: cookie },
        method: 'POST',
      }),
    );

    const removeOldRes = await app.request('/remove/user-1', {
      headers: { Cookie: cookie },
      method: 'POST',
    });
    expect(await removeOldRes.json()).toEqual({ removed: true });
    cookie = requireCookiePair(removeOldRes);

    const removeActiveRes = await app.request('/remove/user-2', {
      headers: { Cookie: cookie },
      method: 'POST',
    });
    expect(await removeActiveRes.json()).toEqual({ removed: false });

    const debugRes = await app.request('/debug-session', {
      headers: { Cookie: cookie },
    });
    await expect(debugRes.json()).resolves.toMatchObject({
      user: { sub: 'user-2', authenticated_at: 1_700_000_100 },
      accounts: [
        {
          sub: 'user-2',
          authenticated_at: 1_700_000_100,
          last_used_at: 1_700_000_100,
        },
      ],
    });
  });

  test('keeps at most five remembered accounts in the encrypted session', async () => {
    const app = createSessionTestApp(true);
    let cookie = '';
    for (let index = 1; index <= 6; index += 1) {
      const init: RequestInit = { method: 'POST' };
      if (cookie) {
        init.headers = { Cookie: cookie };
      }
      const res = await app.request(
        `/login/user-${index}/170000000${index}`,
        init,
      );
      cookie = requireCookiePair(res);
    }

    const debugRes = await app.request('/debug-session', {
      headers: { Cookie: cookie },
    });
    const body = await debugRes.json();

    expect(
      body.accounts.map((account: { sub: string }) => account.sub),
    ).toEqual(['user-2', 'user-3', 'user-4', 'user-5', 'user-6']);
    expect(body.user).toEqual({
      sub: 'user-6',
      authenticated_at: 1_700_000_006,
    });
  });

  test('does not remember authenticated accounts when roster storage is disabled', async () => {
    const app = createSessionTestApp(true, { enabled: false });

    const loginRes = await app.request('/login/user-1/1700000000', {
      method: 'POST',
    });
    const loginCookie = requireCookiePair(loginRes);

    const debugRes = await app.request('/debug-session', {
      headers: { Cookie: loginCookie },
    });

    await expect(debugRes.json()).resolves.toMatchObject({
      user: { sub: 'user-1', authenticated_at: 1_700_000_000 },
      accounts: [],
    });
  });

  test('honors the configured remembered account cap', async () => {
    const app = createSessionTestApp(true, { enabled: true, maxAccounts: 2 });
    let cookie = '';
    for (let index = 1; index <= 3; index += 1) {
      const init: RequestInit = { method: 'POST' };
      if (cookie) {
        init.headers = { Cookie: cookie };
      }
      const res = await app.request(
        `/login/user-${index}/170000000${index}`,
        init,
      );
      cookie = requireCookiePair(res);
    }

    const debugRes = await app.request('/debug-session', {
      headers: { Cookie: cookie },
    });
    const body = await debugRes.json();

    expect(
      body.accounts.map((account: { sub: string }) => account.sub),
    ).toEqual(['user-2', 'user-3']);
  });

  test('expires remembered accounts older than the configured ttl', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_700_000_000_000));
    const app = createSessionTestApp(true, {
      enabled: true,
      maxAccounts: 5,
      ttlMs: 1_000,
    });

    const oldLogin = await app.request('/login/user-old/1699999998', {
      method: 'POST',
    });
    const oldCookie = requireCookiePair(oldLogin);

    const freshLogin = await app.request('/login/user-fresh/1700000000', {
      headers: { Cookie: oldCookie },
      method: 'POST',
    });
    const freshCookie = requireCookiePair(freshLogin);

    const debugRes = await app.request('/debug-session', {
      headers: { Cookie: freshCookie },
    });
    const body = await debugRes.json();

    expect(
      body.accounts.map((account: { sub: string }) => account.sub),
    ).toEqual(['user-fresh']);
  });

  test('updates last_used_at to the current time when selecting a remembered account', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_700_000_200_000));
    const app = createSessionTestApp(true);
    let cookie = requireCookiePair(
      await app.request('/login/user-1/1700000000', { method: 'POST' }),
    );
    cookie = requireCookiePair(
      await app.request('/login/user-2/1700000100', {
        headers: { Cookie: cookie },
        method: 'POST',
      }),
    );

    const selectRes = await app.request('/select/user-1', {
      headers: { Cookie: cookie },
      method: 'POST',
    });
    const selectedCookie = requireCookiePair(selectRes);

    const debugRes = await app.request('/debug-session', {
      headers: { Cookie: selectedCookie },
    });
    const body = await debugRes.json();
    expect(
      body.accounts.find((account: { sub: string }) => account.sub === 'user-1')
        .last_used_at,
    ).toBe(1_700_000_200);
  });

  test('clearAuthSessions clears active and pending auth but keeps remembered accounts for account selection', async () => {
    const app = createSessionTestApp(true);
    const loginRes = await app.request('/login/user-1/1700000000', {
      method: 'POST',
    });
    const loginCookie = requireCookiePair(loginRes);

    const clearRes = await app.request('/clear-auth', {
      headers: { Cookie: loginCookie },
      method: 'POST',
    });
    const clearedCookie = requireCookiePair(clearRes);

    const debugRes = await app.request('/debug-session', {
      headers: { Cookie: clearedCookie },
    });
    await expect(debugRes.json()).resolves.toMatchObject({
      user: null,
      accounts: [
        {
          sub: 'user-1',
          authenticated_at: 1_700_000_000,
          last_used_at: 1_700_000_000,
        },
      ],
    });
  });
});

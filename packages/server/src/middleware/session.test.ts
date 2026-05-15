import { Hono } from 'hono';
import { describe, expect, test } from 'vitest';
import { type SessionEnv, sessionMiddleware } from './session.ts';

const SESSION_SECRET =
  '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b';

function createSessionTestApp(isSecure: boolean) {
  const app = new Hono<SessionEnv>();
  app.use('*', sessionMiddleware(SESSION_SECRET, isSecure));

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

  app.post('/logout', (c) => {
    c.var.session.delete();
    return c.json({ ok: true });
  });

  app.get('/debug-session', (c) =>
    c.json({
      user: c.var.session.get('user') ?? null,
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
      oauth: null,
      passkey_challenge: null,
    });
  });
});

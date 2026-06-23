import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { e, TinyAuthError } from '../schemas/error.ts';
import { csrfProtection } from './csrf.ts';

function createCsrfTestApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof TinyAuthError) {
      return c.json(err.toJson(), err.status);
    }
    return c.json({ code: 'UNEXPECTED_ERROR' }, 500);
  });
  app.use('*', csrfProtection('https://app.example.test'));
  app.post('/api/user/password', (c) => c.json({ ok: true }));
  app.post('/api/admin/users', (c) => c.json({ ok: true }));
  app.get('/api/user/session', (c) => c.json({ ok: true }));
  app.post('/api/oauth/apple/callback', (c) => c.json({ ok: true }));
  return app;
}

describe('csrfProtection middleware', () => {
  it('rejects cross-site unsafe requests carrying an authenticated session cookie', async () => {
    const app = createCsrfTestApp();

    const res = await app.request('/api/user/password', {
      method: 'POST',
      headers: {
        Cookie: 'session=encrypted-session',
        Origin: 'https://evil.example.test',
      },
    });

    expect(res.status).toBe(e.CsrfViolation.Status);
    await expect(res.json()).resolves.toEqual({
      code: 'CSRF_VIOLATION',
      message: 'Request rejected: CSRF validation failed.',
    });
  });

  it('allows same-origin unsafe requests carrying an authenticated session cookie', async () => {
    const app = createCsrfTestApp();

    const res = await app.request('/api/user/password', {
      method: 'POST',
      headers: {
        Cookie: 'session=encrypted-session',
        Origin: 'https://app.example.test',
      },
    });

    expect(res.status).toBe(200);
  });

  it('rejects unsafe requests identified as cross-site by Fetch Metadata', async () => {
    const app = createCsrfTestApp();

    const res = await app.request('/api/user/password', {
      method: 'POST',
      headers: {
        Cookie: 'session=encrypted-session',
        'Sec-Fetch-Site': 'cross-site',
      },
    });

    expect(res.status).toBe(e.CsrfViolation.Status);
  });

  it('rejects cross-site admin requests carrying a session cookie', async () => {
    const app = createCsrfTestApp();

    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: {
        Cookie: 'session=encrypted-session',
        Origin: 'https://evil.example.test',
      },
    });

    expect(res.status).toBe(e.CsrfViolation.Status);
  });

  it('rejects unsafe session-cookie requests without provenance headers', async () => {
    const app = createCsrfTestApp();

    const res = await app.request('/api/user/password', {
      method: 'POST',
      headers: {
        Cookie: 'session=encrypted-session',
        'User-Agent': 'Mozilla/5.0',
      },
    });

    expect(res.status).toBe(e.CsrfViolation.Status);
  });

  it('allows unsafe requests without provenance headers when no session cookie is present', async () => {
    const app = createCsrfTestApp();

    const res = await app.request('/api/user/password', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
  });

  it('does not block read-only GET requests', async () => {
    const app = createCsrfTestApp();

    const res = await app.request('/api/user/session', {
      headers: {
        Cookie: 'session=encrypted-session',
        Origin: 'https://evil.example.test',
      },
    });

    expect(res.status).toBe(200);
  });

  it('exempts OAuth provider callbacks because OAuth state protects them', async () => {
    const app = createCsrfTestApp();

    const res = await app.request('/api/oauth/apple/callback', {
      method: 'POST',
      headers: {
        Cookie: 'session=encrypted-session',
        Origin: 'https://appleid.apple.com',
      },
    });

    expect(res.status).toBe(200);
  });
});

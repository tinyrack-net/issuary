import { expect, inject, test } from 'vitest';

/**
 * Sample e2e test for the default backend configuration.
 *
 * These tests run in a real browser (Playwright) and communicate
 * with a live backend server started by the globalSetup.
 *
 * The backend URL is provided via `inject('backendUrl')`.
 *
 * Note: Vitest browser mode runs tests inside an iframe, so
 * direct page navigation (window.location) is not supported.
 * For API-level e2e tests, use `fetch()` from the browser.
 * For full page navigation tests, use custom Playwright commands.
 */

const backendUrl = inject('backendUrl');

interface ConfigResponse {
  auth: {
    password: {
      enabled: boolean;
    };
  };
}

interface LoginResponse {
  user: {
    email: string;
  };
}

test('backend is running and serves the config endpoint', async () => {
  const res = await fetch(`${backendUrl}/api/config`);
  expect(res.ok).toBe(true);

  const data: ConfigResponse = await res.json();
  expect(data).toHaveProperty('auth');
  expect(data.auth.password.enabled).toBe(true);
});

test('backend serves the login page HTML via proxy', async () => {
  const res = await fetch(`${backendUrl}/login/password`);
  expect(res.ok).toBe(true);

  const html = await res.text();
  expect(html).toContain('<!doctype html>');
  expect(html).toContain('<div id="root">');
});

test('test user is configured and can authenticate', async () => {
  const res = await fetch(`${backendUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'e2e@example.com',
      password: 'password123',
    }),
  });
  expect(res.ok).toBe(true);

  const data: LoginResponse = await res.json();
  expect(data).toHaveProperty('user');
  expect(data.user.email).toBe('e2e@example.com');
});

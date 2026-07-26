import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createServer as createNetServer } from 'node:net';
import { serve } from '@hono/node-server';
import { createApp } from '@tinyrack/tinyauth-server';
import type { TinyAuthRuntimeConfig } from '@tinyrack/tinyauth-server/config';
import { createProxyHandler } from '@tinyrack/tinyauth-server/frontend/proxy';
import type { E2EConfigInput } from '#frontend-e2e/fixtures/index.ts';
import { resolveTestEmailConfig } from '#frontend-e2e/setup/resolve-test-email.ts';

const SHARED_FRONTEND_PORT_ENV = 'E2E_SHARED_FRONTEND_PORT';
const APPLE_STUB_KEY_ID = 'tinyauth-e2e-apple-stub-key';
const BACKEND_BIND_ATTEMPTS = 5;

export type TestHonoApp = Awaited<ReturnType<typeof createE2EServer>>['app'];

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }

  const code = Reflect.get(error, 'code');
  return typeof code === 'string' ? code : undefined;
}

function isAddressInUseError(error: unknown): boolean {
  return getErrorCode(error) === 'EADDRINUSE';
}

function getListeningPort(address: AddressInfo | string | null): number {
  if (typeof address === 'object' && address !== null) {
    return address.port;
  }

  throw new Error('Expected reserved port to have an address');
}

async function closeServer(server: ReturnType<typeof serve>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const closeAllConnections = Reflect.get(server, 'closeAllConnections');
    if (typeof closeAllConnections === 'function') {
      closeAllConnections.call(server);
    }
    server.close((error) => {
      // Already closed is the state we want, not a failure. Rejecting here
      // aborts the rest of teardown, which leaks the database handle.
      if (error && Reflect.get(error, 'code') !== 'ERR_SERVER_NOT_RUNNING') {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function createAppleStubKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const publicJwk = publicKey.export({ format: 'jwk' });

  return {
    privateKey,
    jwks: {
      keys: [
        {
          ...publicJwk,
          alg: 'RS256',
          kid: APPLE_STUB_KEY_ID,
          use: 'sig',
        },
      ],
    },
  };
}

let appleStubKeys: ReturnType<typeof createAppleStubKeys> | undefined;

function getAppleStubKeys() {
  appleStubKeys ??= createAppleStubKeys();
  return appleStubKeys;
}

function createAppleStubIdToken(provider: string): string {
  const { privateKey } = getAppleStubKeys();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(
    JSON.stringify({ alg: 'RS256', kid: APPLE_STUB_KEY_ID, typ: 'JWT' }),
  );
  const payload = base64url(
    JSON.stringify({
      aud: `${provider}-client-id`,
      email: `oauth-${provider}@allowed.test`,
      email_verified: true,
      exp: now + 3600,
      iat: now,
      iss: 'https://appleid.apple.com',
      sub: `oauth-${provider}`,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = createSign('RSA-SHA256')
    .update(signingInput)
    .end()
    .sign(privateKey);

  return `${signingInput}.${base64url(signature)}`;
}

/**
 * Returns the stub profile for the given provider.
 * GitHub-style providers return a GitHub-shaped response (numeric id,
 * avatar_url) with a verified test email so hardened generic OAuth
 * validation can fail closed for real unverified profiles.
 * Apple-style providers should not call userinfo (they use ID tokens).
 * All others return standard OIDC-shaped responses.
 */
function getOAuthStubProfile(provider: string): Record<string, unknown> {
  if (provider === 'stub-not-allowed') {
    return {
      sub: 'oauth-stub-not-allowed',
      email: 'oauth-stub-not-allowed@example.com',
      email_verified: true,
      name: 'OAuth Stub Not Allowed',
      picture: 'https://example.com/stub-not-allowed.png',
    };
  }

  // GitHub-style: numeric id, avatar_url, verified test email
  if (provider.startsWith('github-stub')) {
    return {
      id: 42,
      email: `oauth-${provider}@allowed.test`,
      email_verified: true,
      name: `GitHub ${provider}`,
      avatar_url: `https://example.com/${provider}.png`,
      login: 'octocat',
    };
  }

  if (provider.startsWith('apple-stub')) {
    throw new Error('Apple OAuth stubs must use ID tokens, not userinfo');
  }

  return {
    sub: `oauth-${provider}`,
    email: `oauth-${provider}@allowed.test`,
    email_verified: true,
    name: `OAuth ${provider}`,
    picture: `https://example.com/${provider}.png`,
  };
}

const OAUTH_STUB_SCENARIOS = [
  'success',
  'denied',
  'server_error',
  'temporarily_unavailable',
  'unknown_error',
  'missing_state',
  'missing_code',
  'token_error',
  'userinfo_error',
] as const;

type OAuthStubScenario = (typeof OAUTH_STUB_SCENARIOS)[number];

function parseOAuthStubScenario(
  value: string | undefined,
): OAuthStubScenario | undefined {
  if (!value) {
    return undefined;
  }

  for (const candidate of OAUTH_STUB_SCENARIOS) {
    if (candidate === value) {
      return candidate;
    }
  }

  return undefined;
}

function getOAuthStubScenario(
  provider: string,
  requested: string | undefined,
): OAuthStubScenario {
  const parsed = parseOAuthStubScenario(requested);
  if (parsed) {
    return parsed;
  }

  if (provider.includes('denied')) {
    return 'denied';
  }
  if (provider.includes('server-error')) {
    return 'server_error';
  }
  if (provider.includes('temporarily-unavailable')) {
    return 'temporarily_unavailable';
  }
  if (provider.includes('unknown-error')) {
    return 'unknown_error';
  }
  if (provider.includes('missing-state')) {
    return 'missing_state';
  }
  if (provider.includes('missing-code')) {
    return 'missing_code';
  }
  if (provider.includes('token-error')) {
    return 'token_error';
  }
  if (provider.includes('userinfo-error')) {
    return 'userinfo_error';
  }

  return 'success';
}

function buildOAuthStubCode(
  provider: string,
  scenario: OAuthStubScenario,
): string {
  if (scenario === 'token_error') {
    return `${provider}-token-error-code`;
  }
  if (scenario === 'userinfo_error') {
    return `${provider}-userinfo-error-code`;
  }

  return `${provider}-code`;
}

/**
 * Finds a free port by briefly binding to port 0.
 */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = getListeningPort(srv.address());
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function reserveFreePort(): Promise<{
  port: number;
  release: () => Promise<void>;
}> {
  const srv = createNetServer();
  let released = false;
  await new Promise<void>((resolve, reject) => {
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => resolve());
  });
  const address = srv.address();

  return {
    port: getListeningPort(address),
    release: () =>
      new Promise<void>((resolve, reject) => {
        if (released) {
          resolve();
          return;
        }
        released = true;
        srv.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

export type E2EConfigResult = E2EConfigInput;

type ConfigFactory = (
  backendPort: number,
  frontendPort: number,
  auxiliaryPort: number,
) => E2EConfigResult;

function getSharedFrontendPort(): number {
  const rawPort = process.env[SHARED_FRONTEND_PORT_ENV];
  if (!rawPort) {
    throw new Error(
      `${SHARED_FRONTEND_PORT_ENV} is not set. ` +
        'Ensure Playwright global setup started the shared frontend server.',
    );
  }

  const frontendPort = Number(rawPort);
  if (!Number.isInteger(frontendPort) || frontendPort <= 0) {
    throw new Error(
      `${SHARED_FRONTEND_PORT_ENV} must be a positive integer. Received: ${rawPort}`,
    );
  }

  return frontendPort;
}

function isTestEmailConfig(
  email: E2EConfigResult['email'],
): email is { test: true } {
  return (
    typeof email === 'object' &&
    email !== null &&
    'test' in email &&
    email['test'] === true &&
    !('createTransport' in email)
  );
}

function isResolvedEmailConfig(
  email: E2EConfigResult['email'],
): email is NonNullable<TinyAuthRuntimeConfig['email']> {
  return email !== undefined && 'createTransport' in email;
}

/**
 * Creates and starts the backend server for an e2e test config
 * using a per-server backend port and shared frontend port.
 *
 * Registers test-only endpoints on the backend for accessing
 * email verification tokens and TOTP secrets during e2e tests.
 *
 * @param configFactory - Factory that produces config given ports
 * @returns Object with backendPort and teardown function
 */
export async function createE2EServer(configFactory: ConfigFactory) {
  let lastBindError: unknown;

  for (let attempt = 0; attempt < BACKEND_BIND_ATTEMPTS; attempt++) {
    const backendPort = await getFreePort();
    const frontendPort = getSharedFrontendPort();
    const auxiliaryPortReservation = await reserveFreePort();
    const auxiliaryPort = auxiliaryPortReservation.port;

    const { email: rawEmail, ...restConfig } = configFactory(
      backendPort,
      frontendPort,
      auxiliaryPort,
    );

    // Resolve email config: { test: true } shorthand into a real test email config
    let resolvedEmail: TinyAuthRuntimeConfig['email'];
    if (isTestEmailConfig(rawEmail)) {
      resolvedEmail = await resolveTestEmailConfig();
    } else if (isResolvedEmailConfig(rawEmail)) {
      resolvedEmail = rawEmail;
    }

    const defaultFrontend = createProxyHandler({
      upstream: `http://localhost:${frontendPort}`,
    });

    const config = {
      ...restConfig,
      ...(resolvedEmail ? { email: resolvedEmail } : {}),
      frontend: restConfig.frontend ?? defaultFrontend,
    };

    // 1. Start backend
    const { app, services, cleanup } = await createApp(config);

    // 2. Register test-only API endpoints
    const testApp = app
      .get('/test/email-token/:email', async (c) => {
        const email = c.req.param('email');
        const user = await services.mikro.user.findOne({ email });
        if (!user) {
          return c.json({ error: 'User not found' }, 404);
        }
        const token = await services.mikro.emailVerification.findOne(
          { user: user.sub, verified: false },
          { orderBy: { created_at: 'desc' } },
        );
        if (!token) {
          return c.json({ error: 'No pending token' }, 404);
        }
        return c.json({ token: token.token });
      })
      .get('/test/totp-secret/:userSub', async (c) => {
        const userSub = c.req.param('userSub');
        const totp = await services.mikro.userTotp.findOne(
          { user: userSub },
          { populate: ['secret'] },
        );
        if (!totp) {
          return c.json({ error: 'TOTP not found' }, 404);
        }
        return c.json({ secret: totp.secret });
      })
      .get('/test/password-reset-token/:email', async (c) => {
        const email = c.req.param('email');
        const user = await services.mikro.user.findOne({ email });
        if (!user) {
          return c.json({ error: 'User not found' }, 404);
        }
        const reset = await services.mikro.passwordReset.findOne(
          { user: user.sub, used: false },
          { orderBy: { created_at: 'desc' } },
        );
        if (!reset) {
          return c.json({ error: 'No pending reset token' }, 404);
        }
        return c.json({ token: reset.token });
      })
      .post('/test/totp/setup/:email', async (c) => {
        const email = c.req.param('email');
        const user = await services.mikro.user.findOne({ email });
        if (!user) {
          return c.json({ error: 'User not found' }, 404);
        }
        const secret = services.totpService.generateSecret();
        const totp = services.mikro.userTotp.create({
          user: user.sub,
          secret,
          verified: true,
          recovery_confirmed: true,
        });
        services.mikro.em.persist(totp);
        await services.mikro.em.flush();
        return c.json({ secret });
      })
      .post('/test/totp/setup-with-recovery/:email', async (c) => {
        const email = c.req.param('email');
        const user = await services.mikro.user.findOne({ email });
        if (!user) {
          return c.json({ error: 'User not found' }, 404);
        }
        const setupData = await services.totpService.startSetup(user);
        const code = services.totpService.generateToken(setupData.secret);
        const recoveryCodes = await services.totpService.verifySetup(
          user.sub,
          code,
        );
        await services.totpService.confirmSetup(user.sub);
        return c.json({
          secret: setupData.secret,
          recovery_codes: recoveryCodes,
        });
      })
      .post('/test/passkey/setup/:email', async (c) => {
        const email = c.req.param('email');
        const user = await services.mikro.user.findOne({ email });
        if (!user) {
          return c.json({ error: 'User not found' }, 404);
        }
        const passkey = services.mikro.userPasskey.create({
          user: user.sub,
          credential_id: `test-credential-${randomUUID()}`,
          public_key: 'test-public-key-base64url',
          counter: 0,
          device_type: 'multiDevice',
          backed_up: true,
          transports: ['internal'],
          name: 'E2E Test Passkey',
          aaguid: 'test-aaguid',
        });
        services.mikro.em.persist(passkey);
        await services.mikro.em.flush();
        return c.json({ id: passkey.id });
      })
      .get('/test/oauth-stub/:provider/authorize', async (c) => {
        const provider = c.req.param('provider');
        const redirectUri = c.req.query('redirect_uri');
        const state = c.req.query('state');
        const responseMode = c.req.query('response_mode');
        const scenario = getOAuthStubScenario(
          provider,
          c.req.query('scenario'),
        );

        if (!redirectUri || !state) {
          return c.json({ error: 'Missing redirect_uri or state' }, 400);
        }

        // Apple-style form_post: return HTML that auto-submits a POST form
        if (responseMode === 'form_post') {
          const formFields: string[] = [];

          if (
            scenario === 'denied' ||
            scenario === 'server_error' ||
            scenario === 'temporarily_unavailable' ||
            scenario === 'unknown_error'
          ) {
            const errorCode =
              scenario === 'denied'
                ? 'access_denied'
                : scenario === 'unknown_error'
                  ? 'stub_unknown'
                  : scenario;
            formFields.push(
              `<input type="hidden" name="state" value="${state}">`,
              `<input type="hidden" name="error" value="${errorCode}">`,
              `<input type="hidden" name="error_description" value="${provider} denied by oauth stub">`,
            );
          } else if (scenario === 'missing_state') {
            formFields.push(
              `<input type="hidden" name="code" value="${buildOAuthStubCode(provider, scenario)}">`,
            );
          } else if (scenario === 'missing_code') {
            formFields.push(
              `<input type="hidden" name="state" value="${state}">`,
            );
          } else {
            formFields.push(
              `<input type="hidden" name="state" value="${state}">`,
              `<input type="hidden" name="code" value="${buildOAuthStubCode(provider, scenario)}">`,
            );
          }

          const html = [
            '<html><body>',
            `<form method="POST" action="${redirectUri}">`,
            ...formFields,
            '</form>',
            '<script>document.forms[0].submit();</script>',
            '</body></html>',
          ].join('');
          return c.html(html);
        }

        const callbackUrl = new URL(redirectUri);
        if (scenario !== 'missing_state') {
          callbackUrl.searchParams.set('state', state);
        }

        if (
          scenario === 'denied' ||
          scenario === 'server_error' ||
          scenario === 'temporarily_unavailable' ||
          scenario === 'unknown_error'
        ) {
          const errorCode =
            scenario === 'denied'
              ? 'access_denied'
              : scenario === 'unknown_error'
                ? 'stub_unknown'
                : scenario;
          callbackUrl.searchParams.set('error', errorCode);
          callbackUrl.searchParams.set(
            'error_description',
            `${provider} denied by oauth stub`,
          );
        } else if (scenario !== 'missing_code') {
          callbackUrl.searchParams.set(
            'code',
            buildOAuthStubCode(provider, scenario),
          );
        }

        return c.redirect(callbackUrl.toString());
      })
      .post('/test/oauth-stub/:provider/token', async (c) => {
        const provider = c.req.param('provider');
        const form = await c.req.parseBody();
        const code = form['code'];

        if (typeof code !== 'string') {
          return c.json({ error: 'Missing code' }, 400);
        }

        if (code === `${provider}-token-error-code`) {
          return c.json({ error: 'temporarily_unavailable' }, 503);
        }

        if (
          code !== `${provider}-code` &&
          code !== `${provider}-userinfo-error-code`
        ) {
          return c.json({ error: 'Invalid code' }, 400);
        }

        const hasUserInfoError = code === `${provider}-userinfo-error-code`;
        const tokenResponse: Record<string, unknown> = {
          access_token: hasUserInfoError
            ? `access-token-${provider}-userinfo-error`
            : `access-token-${provider}`,
          token_type: 'Bearer',
          expires_in: 3600,
        };

        // Apple-style: include id_token with user claims
        if (provider.startsWith('apple-stub')) {
          tokenResponse['id_token'] = createAppleStubIdToken(provider);
        }

        return c.json(tokenResponse);
      })
      .get('/test/oauth-stub/:provider/jwks', async (c) => {
        const provider = c.req.param('provider');

        if (!provider.startsWith('apple-stub')) {
          return c.json({ error: 'JWKS not available for provider' }, 404);
        }

        return c.json(getAppleStubKeys().jwks);
      })
      .get('/test/oauth-stub/:provider/userinfo', async (c) => {
        const provider = c.req.param('provider');
        const authorization = c.req.header('authorization');

        const successToken = `Bearer access-token-${provider}`;
        const userinfoErrorToken = `Bearer access-token-${provider}-userinfo-error`;

        if (
          authorization !== successToken &&
          authorization !== userinfoErrorToken
        ) {
          return c.json({ error: 'Invalid token' }, 401);
        }
        if (authorization === userinfoErrorToken) {
          return c.json({ error: 'userinfo_failed' }, 503);
        }

        const profile = getOAuthStubProfile(provider);
        return c.json(profile);
      });

    const backendServer = serve({
      fetch: testApp.fetch,
      port: backendPort,
      hostname: '127.0.0.1',
    });

    /*
     * Node reaps idle keep-alive sockets after 5s by default. Playwright's
     * request context pools connections, so a test that drives the browser for
     * longer than that between two API calls can send on a socket the server is
     * closing and fail with ECONNRESET — the OAuth tests do exactly that,
     * completing a consent flow before exchanging the code.
     *
     * Outliving the 60s per-test timeout means a socket is only ever reaped
     * between tests. `headersTimeout` has to stay above `keepAliveTimeout` or
     * Node reintroduces the same race itself.
     */
    // `serve()` is typed as HTTP/1 or HTTP/2; only the former has these, and
    // only the former is what we asked for.
    if (backendServer instanceof HttpServer) {
      backendServer.keepAliveTimeout = 90_000;
      backendServer.headersTimeout = 95_000;
    }

    try {
      if (!backendServer.listening) {
        await Promise.race([
          once(backendServer, 'listening'),
          once(backendServer, 'error').then(([error]) => {
            throw error;
          }),
        ]);
      }
    } catch (error) {
      await closeServer(backendServer).catch(() => undefined);
      await auxiliaryPortReservation.release();
      await cleanup();
      if (isAddressInUseError(error)) {
        lastBindError = error;
        continue;
      }
      throw error;
    }

    // 3. Return server handle
    //
    // Teardown is idempotent and memoized. `cleanup()` disposes the ORM, and
    // running that twice closes a native handle that is already closing, which
    // aborts the whole Node process — it surfaces as Playwright reporting
    // "worker process exited unexpectedly" against whichever tests happened to
    // be in flight, rather than as an error here.
    let teardownPromise: Promise<void> | undefined;

    return {
      app: testApp,
      backendPort,
      auxiliaryPort,
      releaseAuxiliaryPort: auxiliaryPortReservation.release,
      teardown: () => {
        teardownPromise ??= (async () => {
          await closeServer(backendServer);
          await auxiliaryPortReservation.release();
          await cleanup();
        })();
        return teardownPromise;
      },
    };
  }

  throw lastBindError ?? new Error('Failed to bind e2e backend server');
}

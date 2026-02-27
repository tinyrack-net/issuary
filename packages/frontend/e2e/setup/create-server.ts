import type { AddressInfo } from 'node:net';
import { createServer as createNetServer } from 'node:net';
import { serve } from '@hono/node-server';
import type { AppConfigInput } from '@tinyauth/backend';
import { createApp } from '@tinyauth/backend';

const SHARED_FRONTEND_PORT_ENV = 'E2E_SHARED_FRONTEND_PORT';

export type TestHonoApp = Awaited<ReturnType<typeof createE2EServer>>['app'];

/**
 * Base64url encode a string (no padding).
 */
function base64url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Create an unsigned JWT (alg: "none") with the given claims.
 * Used to simulate Apple-style ID tokens in OAuth stubs.
 * The backend's decodeJwt() decodes without signature verification.
 */
function createUnsignedJwt(claims: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = base64url(JSON.stringify(claims));
  return `${header}.${payload}.`;
}

/**
 * Returns the stub profile for the given provider.
 * GitHub-style providers return a GitHub-shaped response (numeric id,
 * avatar_url, no email_verified).
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

  // GitHub-style: numeric id, avatar_url, no email_verified
  if (provider.startsWith('github-stub')) {
    return {
      id: 42,
      email: `oauth-${provider}@allowed.test`,
      name: `GitHub ${provider}`,
      avatar_url: `https://example.com/${provider}.png`,
      login: 'octocat',
    };
  }

  // Apple-style: should not reach userinfo endpoint
  if (provider.startsWith('apple-stub')) {
    throw new Error(
      `Apple stub '${provider}' should not call userinfo endpoint`,
    );
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
      const port = (srv.address() as AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

type ConfigFactory = (
  backendPort: number,
  frontendPort: number,
) => AppConfigInput;

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
  const backendPort = await getFreePort();
  const frontendPort = getSharedFrontendPort();

  const config = configFactory(backendPort, frontendPort);

  // 1. Start backend
  const { app, services, cleanup } = await createApp({ config });

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
    .get('/test/oauth-stub/:provider/authorize', async (c) => {
      const provider = c.req.param('provider');
      const redirectUri = c.req.query('redirect_uri');
      const state = c.req.query('state');
      const responseMode = c.req.query('response_mode');
      const scenario = getOAuthStubScenario(provider, c.req.query('scenario'));

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
        tokenResponse['id_token'] = createUnsignedJwt({
          iss: 'https://appleid.apple.com',
          sub: `oauth-${provider}`,
          email: `oauth-${provider}@allowed.test`,
          email_verified: true,
        });
      }

      return c.json(tokenResponse);
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
    hostname: '0.0.0.0',
  });

  // 3. Return server handle
  return {
    app: testApp,
    backendPort,
    teardown: async () => {
      backendServer.close();
      await cleanup();
    },
  };
}

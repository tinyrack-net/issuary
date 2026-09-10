import { createServer } from 'node:http';
import { mock } from 'node:test';
import { RequestContext } from '@mikro-orm/core';
import { z } from 'zod';
import { createApp } from '../entrypoints/app.js';
import { DatabaseBackgroundJobStore } from '../entrypoints/scheduler/database.js';
import { seedConfigIfNeeded } from '../seeders/config.seeder.js';
import { securityProcessConfig } from './security-process-config.js';

const path = process.env['SECURITY_SQLITE_PATH'];
if (!path) throw new Error('Missing isolated database path');
const config = securityProcessConfig(path);
const { app, services, cleanup } = await createApp(
  {
    ...config,
    email: { createTransport: async () => ({ sendMail: async () => {} }) },
    database: {
      ...config.database,
      initialize: async (orm) => {
        if (!process.env['SECURITY_POSTGRES_PORT'])
          await orm.em.getConnection().execute('pragma busy_timeout = 5000');
      },
    },
  },
  { seedConfig: 'skip' },
);
// The fixture controls mail claims explicitly via IPC.
await services.mailQueue.stop();
let release: (() => void) | undefined;
process.on('message', (message) => {
  if (message === 'go') {
    release?.();
    release = undefined;
  }
});
const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    if (incoming.headers['x-test-barrier']) {
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      process.send?.({ event: 'arrived' });
      await gate;
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers))
      if (value)
        headers.set(name, Array.isArray(value) ? value.join(',') : value);
    const body = Buffer.concat(chunks);
    const response = await app.request(`http://localhost${incoming.url}`, {
      method: incoming.method ?? 'GET',
      headers,
      ...(body.length ? { body } : {}),
    });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500);
    outgoing.end();
  }
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected TCP address');
  process.send?.({ event: 'ready', port: address.port });
});
process.on('message', (message) => {
  if (message === 'stop')
    server.close(() => {
      void cleanup().then(() => process.exit(0));
    });
});

process.on('message', (message) => {
  if (message !== 'seed') return;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  process.send?.({ event: 'arrived' });
  void gate
    .then(async () => {
      await seedConfigIfNeeded(
        services.mikro.orm.em.fork(),
        services.config,
        services.securityService,
      );
      process.send?.({ event: 'seeded' });
    })
    .catch(() => process.exit(1));
});

process.on('message', (message) => {
  if (message !== 'claim-mail') return;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  process.send?.({ event: 'arrived' });
  void gate
    .then(async () => {
      const store = new DatabaseBackgroundJobStore(
        services.mikro,
        ['security.mail'],
        true,
      );
      const job = await store.acquireDueJob(
        new Date(),
        new Date(Date.now() + 60000),
        `fixture:${process.pid}`,
      );
      process.send?.({ event: 'claimed', jobId: job?.id });
    })
    .catch(() => process.exit(1));
});

process.on('message', (message) => {
  if (message === 'require-mfa' || message === 'optional-mfa') {
    services.config.auth.password.two_factor.enrollment_required =
      message === 'require-mfa';
    process.send?.({ event: 'configured' });
  }
});

process.on('message', (message) => {
  if (
    message === 'clock-ahead' ||
    message === 'clock-behind' ||
    message === 'clock-reset'
  ) {
    mock.timers.reset();
    if (message !== 'clock-reset')
      mock.timers.enable({
        apis: ['Date'],
        now: Date.now() + (message === 'clock-ahead' ? 30000 : -30000),
      });
    process.send?.({ event: 'clock-set' });
  }
});

process.on('message', (message) => {
  if (message === 'pause-oauth') {
    services.oauthConnectService.exchangeCodeForTokens = async () => ({
      access_token: 'isolated-provider-token',
      token_type: 'Bearer',
    });
    services.oauthConnectService.fetchUserInfo = async () => {
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      process.send?.({ event: 'arrived' });
      await gate;
      return {
        id: 'paused-provider-user',
        email: 'paused@provider.test',
        email_verified: true,
      };
    };
    process.send?.({ event: 'configured' });
  }
  if (message === 'pause-passkey') {
    services.passkeyService.prepareRegistration = async () => {
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      process.send?.({ event: 'arrived' });
      await gate;
      return {
        verified: true,
        registrationInfo: {
          fmt: 'none',
          aaguid: '',
          credential: {
            id: 'paused-credential',
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
          },
          credentialType: 'public-key',
          attestationObject: new Uint8Array(),
          userVerified: true,
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
          origin: 'http://localhost:8080',
          rpID: 'localhost',
        },
      };
    };
    process.send?.({ event: 'configured' });
  }
});

const LoginRaceControl = z.object({
  command: z.enum([
    'pause-password-login',
    'pause-login-proof',
    'pause-auto-link-proof',
  ]),
  providerId: z.string().optional(),
  email: z.string().optional(),
});
process.on('message', (input) => {
  const parsed = LoginRaceControl.safeParse(input);
  if (!parsed.success) return;
  const control = parsed.data;
  const pause = async () => {
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    process.send?.({ event: 'arrived' });
    await gate;
  };
  if (control.command === 'pause-password-login') {
    const original =
      services.passwordAuthService.authenticateByEmailAndPassword.bind(
        services.passwordAuthService,
      );
    services.passwordAuthService.authenticateByEmailAndPassword = async (
      ...args
    ) => {
      services.passwordAuthService.authenticateByEmailAndPassword = original;
      await pause();
      return original(...args);
    };
  } else if (control.command === 'pause-auto-link-proof') {
    const provider = services.config.identity_providers.find(
      (value) => value.id === 'google',
    );
    if (provider) provider.email_conflict_strategy = 'auto_link';
    const original = services.oauthConnectService.prepareAuthentication.bind(
      services.oauthConnectService,
    );
    services.oauthConnectService.prepareAuthentication = async (...args) => {
      services.oauthConnectService.prepareAuthentication = original;
      const proof = await original(...args);
      await pause();
      return proof;
    };
  } else {
    const original =
      services.oauthConnectService.prepareExistingAuthentication.bind(
        services.oauthConnectService,
      );
    services.oauthConnectService.prepareExistingAuthentication = async (
      ...args
    ) => {
      services.oauthConnectService.prepareExistingAuthentication = original;
      const proof = await original(...args);
      await pause();
      return proof;
    };
  }
  if (control.command !== 'pause-password-login') {
    services.oauthConnectService.exchangeCodeForTokens = async () => ({
      access_token: 'login-race-token',
      token_type: 'Bearer',
    });
    services.oauthConnectService.fetchUserInfo = async () => ({
      id: control.providerId ?? '',
      email: control.email ?? '',
      email_verified: true,
    });
  }
  process.send?.({ event: 'configured' });
});

const IssueTokenControl = z.object({
  command: z.literal('issue-token'),
  kind: z.enum(['email', 'reset']),
  sub: z.string(),
  barrier: z.boolean().optional(),
});
process.on('message', (input) => {
  const parsed = IssueTokenControl.safeParse(input);
  if (!parsed.success) return;
  const issue = async () => {
    if (parsed.data.barrier) {
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      process.send?.({ event: 'arrived' });
      await gate;
    }
    await RequestContext.create(services.mikro.orm.em.fork(), async () => {
      const token =
        parsed.data.kind === 'email'
          ? await services.emailService.generateToken({
              userSub: parsed.data.sub,
            })
          : await services.passwordResetService.generateToken({
              userSub: parsed.data.sub,
            });
      process.send?.({ event: 'issued', token: token.token });
    });
  };
  void issue().catch(() => process.exit(1));
});

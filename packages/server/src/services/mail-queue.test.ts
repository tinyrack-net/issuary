import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { BackgroundJobEntitySchema } from '../entities/background-job.entity.js';
import { DatabaseBackgroundJobStore } from '../entrypoints/scheduler/database.js';
import { withMikroContext } from '../test-utils/helpers.js';
import { securityProcessConfig } from '../test-utils/security-process-config.js';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
  type TestEmailMessage,
} from '../test-utils/setup.js';
import { invalidateUserAuthentication } from './authentication-epoch.js';
import { withUserSecurity } from './user-security.service.js';

let server: Awaited<ReturnType<typeof createTestApp>>;
const sent: Array<TestEmailMessage & { messageId?: string | undefined }> = [];
let failure = false;
let permanent = false;
let deliveryGate: { started: () => void; wait: Promise<void> } | undefined;
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    database: process.env['SECURITY_POSTGRES_PORT']
      ? securityProcessConfig(
          `/tmp/mail-queue-${crypto.randomUUID()}/test.sqlite`,
        ).database
      : MINIMAL_TEST_CONFIG.database,
    registration: { enabled: true, allowed_email_patterns: ['*'] },
    email: {
      createTransport: async () => ({
        sendMail: async (message) => {
          sent.push(message);
          if (deliveryGate) {
            deliveryGate.started();
            await deliveryGate.wait;
          }
          if (permanent)
            throw Object.assign(new Error('private SMTP detail'), {
              responseCode: 550,
            });
          if (failure)
            throw new Error('SMTP user=secret@example.test token=secret');
        },
      }),
    },
  });
});
afterAll(async () => {
  await server.cleanup();
  vi.useRealTimers();
});
async function user() {
  return withMikroContext(server.services, async () => {
    const entity = server.services.mikro.user.create({
      email: `${crypto.randomUUID()}@example.test`,
      created_at: new Date(Date.now() - 1000),
      updated_at: new Date(Date.now() - 1000),
    });
    await server.services.mikro.em.persist(entity).flush();
    return entity;
  });
}
async function submit(email: string) {
  return server.app.request('/api/auth/password/forgot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}
test('public requests persist uniform encrypted jobs without looking up accounts', async () => {
  const existing = await user();
  const lookup = vi.spyOn(
    server.services.passwordResetService,
    'requestPasswordReset',
  );
  const count = sent.length;
  expect((await submit(existing.email)).status).toBe(200);
  expect((await submit('missing@example.test')).status).toBe(200);
  expect(lookup).not.toHaveBeenCalled();
  expect(sent).toHaveLength(count);
  const jobs = await server.services.mikro.em
    .fork()
    .find(BackgroundJobEntitySchema, { status: 'pending' });
  expect(jobs).toHaveLength(2);
  expect(JSON.stringify(jobs)).not.toContain(existing.email);
  expect(JSON.stringify(jobs)).not.toContain('missing@example.test');
  await server.services.mailQueue.runPending();
  expect(sent).toHaveLength(count + 1);
  expect(sent.at(-1)?.to).toBe(existing.email);
  const finished = await server.services.mikro.em
    .fork()
    .find(BackgroundJobEntitySchema, { status: 'succeeded' });
  expect(finished.every((job) => job.payload === 'null')).toBe(true);
  lookup.mockRestore();
});
test('a failed delivery retains the same token and Message-ID on its next attempt', async () => {
  const existing = await user();
  await submit(existing.email);
  failure = true;
  await server.services.mailQueue.runPending();
  failure = false;
  const first = sent.at(-1);
  const em = server.services.mikro.em.fork();
  const pending = await em.findOneOrFail(BackgroundJobEntitySchema, {
    status: 'pending',
  });
  expect(pending.lastError).toBe('MAIL_DELIVERY_FAILED');
  expect(pending.payload).not.toContain(existing.email);
  await em.nativeUpdate(
    BackgroundJobEntitySchema,
    { id: pending.id },
    { availableAt: new Date(0) },
  );
  await server.services.mailQueue.runPending();
  expect(sent.at(-1)).toEqual(first);
  expect(
    (
      await em.findOneOrFail(
        BackgroundJobEntitySchema,
        { id: pending.id },
        { refresh: true },
      )
    ).payload,
  ).toBe('null');
});
test('a request cannot target an account created after it was accepted', async () => {
  const address = `${crypto.randomUUID()}@example.test`;
  await submit(address);
  await withMikroContext(server.services, async () => {
    const entity = server.services.mikro.user.create({
      email: address,
      created_at: new Date(Date.now() + 1000),
    });
    await server.services.mikro.em.persist(entity).flush();
  });
  const count = sent.length;
  await server.services.mailQueue.runPending();
  expect(sent).toHaveLength(count);
});

test('permanent SMTP rejection is terminal and scrubs the payload', async () => {
  const existing = await user();
  await submit(existing.email);
  permanent = true;
  await server.services.mailQueue.runPending();
  permanent = false;
  const failed = await server.services.mikro.em
    .fork()
    .findOneOrFail(BackgroundJobEntitySchema, { status: 'failed' });
  expect(failed.attemptCount).toBe(1);
  expect(failed.payload).toBe('null');
  expect(failed.lastError).toBe('MAIL_PERMANENT_FAILURE');
});
test('expired worker lease is recovered with the prepared token', async () => {
  const existing = await user();
  await submit(existing.email);
  failure = true;
  await server.services.mailQueue.runPending();
  failure = false;
  const first = sent.at(-1);
  const em = server.services.mikro.em.fork();
  const job = await em.findOneOrFail(BackgroundJobEntitySchema, {
    status: 'pending',
  });
  await em.nativeUpdate(
    BackgroundJobEntitySchema,
    { id: job.id },
    {
      status: 'running',
      lockedBy: 'terminated-process',
      lockedUntil: new Date(0),
      availableAt: new Date(0),
    },
  );
  await server.services.mailQueue.runPending();
  expect(sent.at(-1)).toEqual(first);
  expect(
    (
      await em.findOneOrFail(
        BackgroundJobEntitySchema,
        { id: job.id },
        { refresh: true },
      )
    ).payload,
  ).toBe('null');
});

test('slow SMTP does not hold a later HTTP response', async () => {
  const existing = await user();
  await submit(existing.email);
  let release: () => void = () => {};
  let started: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  deliveryGate = {
    started,
    wait: new Promise<void>((resolve) => {
      release = resolve;
    }),
  };
  const drain = server.services.mailQueue.runPending();
  try {
    await ready;
    expect((await submit(`${crypto.randomUUID()}@example.test`)).status).toBe(
      200,
    );
  } finally {
    release();
    deliveryGate = undefined;
    await drain;
  }
});
test('two mail stores cannot claim the same job and unregistered workers cannot take it', async () => {
  const existing = await user();
  await submit(existing.email);
  const now = new Date();
  const excluded = new DatabaseBackgroundJobStore(server.services.mikro, [
    'unrelated',
  ]);
  expect(
    await excluded.acquireDueJob(now, new Date(Date.now() + 60000), 'other'),
  ).toBeNull();
  const first = new DatabaseBackgroundJobStore(
    server.services.mikro,
    ['security.mail'],
    true,
  );
  const second = new DatabaseBackgroundJobStore(
    server.services.mikro,
    ['security.mail'],
    true,
  );
  const claimed = await Promise.all([
    first.acquireDueJob(now, new Date(Date.now() + 60000), 'a'),
    second.acquireDueJob(now, new Date(Date.now() + 60000), 'b'),
  ]);
  expect(claimed.filter(Boolean)).toHaveLength(1);
  await server.services.mikro.em
    .fork()
    .nativeUpdate(
      BackgroundJobEntitySchema,
      { status: 'running' },
      { lockedUntil: new Date(0) },
    );
  await server.services.mailQueue.runPending();
});
test('registration and mail enqueue roll back together on queue storage failure', async () => {
  const address = `${crypto.randomUUID()}@example.test`;
  const spy = vi
    .spyOn(server.services.mailQueue, 'enqueue')
    .mockRejectedValueOnce(new Error('injected queue storage failure'));
  try {
    const response = await server.app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: address,
        password: 'security-password-123',
      }),
    });
    expect(response.status).toBe(500);
    await withMikroContext(server.services, async () => {
      expect(await server.services.mikro.user.count({ email: address })).toBe(
        0,
      );
    });
  } finally {
    spy.mockRestore();
  }
});

test('mail polling starts without an optional cleanup scheduler', async () => {
  const existing = await user();
  await submit(existing.email);
  let started: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  deliveryGate = { started, wait: Promise.resolve() };
  try {
    await vi.advanceTimersByTimeAsync(5000);
    await ready;
  } finally {
    deliveryGate = undefined;
    await server.services.mailQueue.runPending();
  }
  expect(sent.at(-1)?.to).toBe(existing.email);
});

test('transient delivery failure stops after three attempts and removes sensitive payload', async () => {
  const existing = await user();
  await submit(existing.email);
  const em = server.services.mikro.em.fork();
  const job = await em.findOneOrFail(BackgroundJobEntitySchema, {
    status: 'pending',
  });
  const count = sent.length;
  failure = true;
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      await em.nativeUpdate(
        BackgroundJobEntitySchema,
        { id: job.id },
        { availableAt: new Date(0) },
      );
      await server.services.mailQueue.runPending();
    }
  } finally {
    failure = false;
  }
  const finished = await em.findOneOrFail(
    BackgroundJobEntitySchema,
    { id: job.id },
    { refresh: true },
  );
  expect(sent).toHaveLength(count + 3);
  expect(finished.status).toBe('failed');
  expect(finished.payload).toBe('null');
  expect(finished.attemptCount).toBe(3);
});
test('a token consumed between mail attempts is not delivered again', async () => {
  const existing = await user();
  await submit(existing.email);
  failure = true;
  try {
    await server.services.mailQueue.runPending();
  } finally {
    failure = false;
  }
  const count = sent.length;
  await withMikroContext(server.services, async () => {
    await server.services.mikro.passwordReset.nativeUpdate(
      { user: existing.sub },
      { used: true },
    );
  });
  const em = server.services.mikro.em.fork();
  const job = await em.findOneOrFail(BackgroundJobEntitySchema, {
    status: 'pending',
  });
  await em.nativeUpdate(
    BackgroundJobEntitySchema,
    { id: job.id },
    { availableAt: new Date(0) },
  );
  await server.services.mailQueue.runPending();
  expect(sent).toHaveLength(count);
  expect(
    (
      await em.findOneOrFail(
        BackgroundJobEntitySchema,
        { id: job.id },
        { refresh: true },
      )
    ).payload,
  ).toBe('null');
});

test('an epoch change between mail attempts prevents delivery and replacement tokens', async () => {
  const existing = await user();
  await submit(existing.email);
  failure = true;
  try {
    await server.services.mailQueue.runPending();
  } finally {
    failure = false;
  }
  const count = sent.length;
  await withMikroContext(server.services, () =>
    withUserSecurity(server.services.mikro, existing.sub, async (fresh) => {
      await invalidateUserAuthentication(server.services.mikro.em, fresh);
      await server.services.mikro.em.flush();
    }),
  );
  const em = server.services.mikro.em.fork();
  const job = await em.findOneOrFail(BackgroundJobEntitySchema, {
    status: 'pending',
  });
  await em.nativeUpdate(
    BackgroundJobEntitySchema,
    { id: job.id },
    { availableAt: new Date(0) },
  );
  await server.services.mailQueue.runPending();
  expect(sent).toHaveLength(count);
  await withMikroContext(server.services, async () => {
    expect(
      await server.services.mikro.passwordReset.count({ user: existing.sub }),
    ).toBe(1);
    expect(
      await server.services.mikro.passwordReset.count({
        user: existing.sub,
        expiresAt: { $gt: new Date() },
        revoked_at: null,
      }),
    ).toBe(0);
  });
  expect(
    (
      await em.findOneOrFail(
        BackgroundJobEntitySchema,
        { id: job.id },
        { refresh: true },
      )
    ).payload,
  ).toBe('null');
});

test.each(['verification', 'reset'])(
  'a superseded %s token is not sent again by a clock-behind worker',
  async (kind) => {
    const existing = await user();
    await withMikroContext(server.services, () =>
      server.services.mailQueue.enqueue(
        kind === 'verification' ? 'verification' : 'password-reset',
        existing.email,
        'en',
        existing.sub,
      ),
    );
    const count = sent.length;
    failure = true;
    try {
      await server.services.mailQueue.runPending();
    } finally {
      failure = false;
    }
    expect(sent).toHaveLength(count + 1);
    const em = server.services.mikro.em.fork();
    const job = await em.findOneOrFail(BackgroundJobEntitySchema, {
      status: 'pending',
    });
    const now = Date.now();
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(now + 30000);
    try {
      await withMikroContext(server.services, () =>
        kind === 'verification'
          ? server.services.emailService.generateToken({
              userSub: existing.sub,
            })
          : server.services.passwordResetService.generateToken({
              userSub: existing.sub,
            }),
      );
    } finally {
      vi.useRealTimers();
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    }
    await em.nativeUpdate(
      BackgroundJobEntitySchema,
      { id: job.id },
      { availableAt: new Date(0) },
    );
    await server.services.mailQueue.runPending();
    expect(sent).toHaveLength(count + 1);
    const completed = await em.findOneOrFail(
      BackgroundJobEntitySchema,
      { id: job.id },
      { refresh: true },
    );
    expect(completed.status).toBe('succeeded');
    expect(completed.payload).toBe('null');
  },
);

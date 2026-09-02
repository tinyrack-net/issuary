import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../entrypoints/app.ts';
import {
  createTestApp,
  createTestEmailConfig,
  MINIMAL_TEST_CONFIG,
} from './setup.ts';

describe('createTestApp', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp();
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('creates an app from the minimal resolved test config', async () => {
    const client = testClient(app);
    const res = await client.api.health.$get();

    expect(res.status).toBe(200);
  });

  test('accepts overridden resolved config', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      server: {
        public_origin: 'http://localhost:9090',
      },
    });

    try {
      const res = await server.app.request('/.well-known/openid-configuration');
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({
        issuer: 'http://localhost:9090',
      });
    } finally {
      await server.cleanup();
    }
  });

  test('creates a deterministic in-memory email config that captures messages', async () => {
    const sentMessages: {
      from?: string | undefined;
      to: string;
      subject: string;
      text: string;
      html: string;
    }[] = [];

    const email = await createTestEmailConfig({
      from: 'no-reply@test.local',
      sentMessages,
    });
    const transport = await email.createTransport();

    await transport.sendMail({
      from: email.from,
      to: 'user@example.com',
      subject: 'Test Subject',
      text: 'Hello text',
      html: '<p>Hello html</p>',
    });

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]?.from).toBe('no-reply@test.local');
    expect(sentMessages[0]?.to).toBe('user@example.com');
    expect(sentMessages[0]?.subject).toBe('Test Subject');
  });
});

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createServer } from '@/server.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer().start();
});

afterAll(async () => {
  await app?.close();
});

test('list all articles', async () => {
  const res = await app.inject({
    method: 'get',
    url: '/application/oauth/authorize',
  });

  expect(res.statusCode).toBe(500);
});

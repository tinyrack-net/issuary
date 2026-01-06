import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createServer } from './server.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer().start();
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
});

test('list all articles', async () => {
  // mimic the http request via `app.inject()`
  const res = await app.inject({
    method: 'get',
    url: '/api/v1/config',
  });

  // assert it was successful response
  expect(res.statusCode).toBe(200);

  // with expected shape
  // expect(res.json()).toMatchObject({
  //   items: [],
  //   total: 0,
  // });
});

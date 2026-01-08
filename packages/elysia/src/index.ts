import { node } from '@elysiajs/node';
import { Elysia } from 'elysia';

const app = new Elysia({ adapter: node() })
  .get('/', () => 'Hello Elysia')
  .listen(3001, ({ hostname, port }) => {
    console.log(`🦊 Elysia is running at ${hostname}:${port}`);
  });

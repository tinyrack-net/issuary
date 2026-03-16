/// <reference types="@cloudflare/workers-types" />
import { getPlatformProxy } from 'wrangler';
import { d1 } from './d1.js';

const proxy = await getPlatformProxy<{ DB: D1Database }>({
  configPath: '../../examples/cloudflare-worker-hono/wrangler.jsonc',
});

const options = await d1({
  database: proxy.env.DB,
}).getMikroOrmOptions();

await proxy.dispose();

export default options;

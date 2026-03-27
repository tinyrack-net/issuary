/// <reference types="@cloudflare/workers-types" />
import { getPlatformProxy } from 'wrangler';
import { d1 } from './d1.ts';

const proxy = await getPlatformProxy<{ DB: D1Database }>({
  configPath: '../../examples/servers/cloudflare-hono-d1/wrangler.jsonc',
});

const options = await d1({
  database: proxy.env.DB,
}).getMikroOrmOptions();

await proxy.dispose();

export default options;

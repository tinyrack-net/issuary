import type { Options } from '@mikro-orm/core';
import { sqlite } from './sqlite.ts';

const options = await sqlite({
  path: '/path/some',
  test: true,
}).getMikroOrmOptions();

const config: Partial<Options> = {
  ...options,
  migrations: {
    ...options.migrations,
    path: './src/migrations/sqlite',
  },
};

export default config;

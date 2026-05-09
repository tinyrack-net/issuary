import type { Options } from '@mikro-orm/core';
import { postgres } from './postgres.ts';

const options = await postgres({
  host: 'localhost',
  name: 'tinyauth',
  password: 'tinyauth',
  port: 5432,
  user: 'tinyauth',
}).getMikroOrmOptions();

const config: Partial<Options> = {
  ...options,
  driverOptions: {
    ssl: false,
  },
  migrations: {
    ...options.migrations,
    path: './src/migrations/postgres',
  },
};

export default config;

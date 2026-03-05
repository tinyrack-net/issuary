import { describe, expect, test } from 'vitest';
import { postgres, sqlite } from '#backend/database.js';

describe('database config factories', () => {
  test('composes sqlite database config', async () => {
    const config = sqlite({
      type: 'sqlite',
      path: './test.db',
      test: true,
    });

    expect(config.type).toBe('sqlite');
    expect(config.test).toBe(true);
    expect(typeof config.getMikroOrmOptions).toBe('function');

    const mikroConfig = await config.getMikroOrmOptions();
    expect(mikroConfig.dbName).toBe(':memory:');
  });

  test('composes postgres database config', async () => {
    const config = postgres({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      user: 'test',
      password: 'test',
      name: 'test',
    });

    expect(config.type).toBe('postgres');
    expect(config.host).toBe('localhost');
    expect(typeof config.getMikroOrmOptions).toBe('function');
  });
});

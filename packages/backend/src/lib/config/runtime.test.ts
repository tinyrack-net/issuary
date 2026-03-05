import { describe, expect, test } from 'vitest';
import { postgres, smtp, sqlite } from './runtime.js';

describe('runtime config factories', () => {
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

  test('returns false preview url for non-test smtp config', () => {
    const config = smtp({
      host: 'localhost',
      port: 465,
      secure: true,
      user: 'user',
      password: 'password',
      test: false,
    });

    expect(config.test).toBe(false);
    expect(typeof config.createTransport).toBe('function');
    expect(typeof config.getTestMessageUrl).toBe('function');
  });
});

import { describe, expect, test } from 'vitest';
import { POSTGRES_MIGRATIONS } from '../../migrations/postgres/index.ts';
import { Migration20260509171036_initial as PostgresInitialMigration } from '../../migrations/postgres/Migration20260509171036_initial.ts';
import { SQLITE_MIGRATIONS } from '../../migrations/sqlite/index.ts';
import { Migration20260509171226_initial as SqliteInitialMigration } from '../../migrations/sqlite/Migration20260509171226_initial.ts';
import { postgres } from './postgres/postgres.ts';
import { sqlite } from './sqlite/sqlite.ts';

describe('database migrations', () => {
  test('postgres uses explicit migration imports', async () => {
    const options = await postgres({
      host: 'localhost',
      name: 'tinyauth',
      password: 'tinyauth',
      port: 5432,
      user: 'tinyauth',
    }).getMikroOrmOptions();

    expect(POSTGRES_MIGRATIONS).toEqual([PostgresInitialMigration]);
    expect(options.migrations?.migrationsList).toBe(POSTGRES_MIGRATIONS);
    expect(options.migrations?.path).toBeUndefined();
    expect(options.migrations?.pathTs).toBeUndefined();
    expect(options.driverOptions).toEqual({ ssl: true });
    expect(options.debug).toBe(false);
  });

  test('postgres accepts custom driver options', async () => {
    const options = await postgres({
      host: 'localhost',
      name: 'tinyauth',
      password: 'tinyauth',
      port: 5432,
      user: 'tinyauth',
      driverOptions: {
        ssl: false,
      },
      debug: true,
    }).getMikroOrmOptions();

    expect(options.driverOptions).toEqual({ ssl: false });
    expect(options.debug).toBe(true);
  });

  test('sqlite uses explicit migration imports', async () => {
    const options = await sqlite({
      path: './test.db',
      test: false,
    }).getMikroOrmOptions();

    expect(SQLITE_MIGRATIONS).toEqual([SqliteInitialMigration]);
    expect(options.migrations?.migrationsList).toBe(SQLITE_MIGRATIONS);
    expect(options.migrations?.path).toBeUndefined();
    expect(options.migrations?.pathTs).toBeUndefined();
    expect(options.debug).toBe(false);
  });

  test('sqlite accepts custom debug option', async () => {
    const options = await sqlite({
      path: './test.db',
      test: false,
      debug: true,
    }).getMikroOrmOptions();

    expect(options.debug).toBe(true);
  });
});

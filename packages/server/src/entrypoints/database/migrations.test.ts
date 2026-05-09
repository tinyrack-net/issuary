import { describe, expect, test } from 'vitest';
import { D1_MIGRATIONS } from '../../migrations/d1/index.ts';
import { Migration20260509172833_initial as D1InitialMigration } from '../../migrations/d1/Migration20260509172833_initial.ts';
import { POSTGRES_MIGRATIONS } from '../../migrations/postgres/index.ts';
import { Migration20260509171036_initial as PostgresInitialMigration } from '../../migrations/postgres/Migration20260509171036_initial.ts';
import { SQLITE_MIGRATIONS } from '../../migrations/sqlite/index.ts';
import { Migration20260509171226_initial as SqliteInitialMigration } from '../../migrations/sqlite/Migration20260509171226_initial.ts';
import { d1 } from './d1/d1.ts';
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
  });

  test('d1 uses explicit migration imports', async () => {
    const options = await d1({
      database: {} as D1Database,
    }).getMikroOrmOptions();

    expect(D1_MIGRATIONS).toEqual([D1InitialMigration]);
    expect(options.migrations?.migrationsList).toBe(D1_MIGRATIONS);
    expect(options.migrations?.path).toBeUndefined();
    expect(options.migrations?.pathTs).toBeUndefined();
  });
});

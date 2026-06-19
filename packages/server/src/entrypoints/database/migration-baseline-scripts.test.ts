import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const packageRoot = resolve(import.meta.dirname, '../../..');

describe('migration creation scripts', () => {
  test('use baseline-prepared wrappers instead of direct MikroORM migration:create', async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(packageRoot, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts['mikro-orm:migration:create:postgres']).toBe(
      'node ./scripts/create-migration-with-baseline.mjs postgres',
    );
    expect(packageJson.scripts['mikro-orm:migration:create:sqlite']).toBe(
      'node ./scripts/create-migration-with-baseline.mjs sqlite',
    );
  });

  test('documents the baseline behavior inside the migration wrapper', async () => {
    const wrapper = await readFile(
      resolve(packageRoot, 'scripts/create-migration-with-baseline.mjs'),
      'utf8',
    );

    expect(wrapper).toContain('applyExistingMigrations');
    expect(wrapper).toContain('runMikroOrmMigrationCreate');
    expect(wrapper).toContain('removeKnownSqliteNoopMigration');
    expect(wrapper).toContain('TINYAUTH_MIGRATION_SQLITE_DB_PATH');
    expect(wrapper).toContain('TINYAUTH_MIGRATION_POSTGRES_PORT');
  });
});

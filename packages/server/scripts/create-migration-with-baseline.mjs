import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const dialect = process.argv[2];
const extraMigrationArgs = process.argv.slice(3).filter((arg) => arg !== '--');

if (dialect !== 'postgres' && dialect !== 'sqlite') {
  console.error(
    'Usage: node ./scripts/create-migration-with-baseline.mjs <postgres|sqlite> [...migration:create args]',
  );
  process.exit(1);
}

const packageRoot = process.cwd();

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    env: { ...process.env, ...options.env },
    shell: process.platform === 'win32' && command === 'pnpm',
    stdio: options.stdio ?? 'inherit',
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}`,
    );
  }

  return result.stdout ?? '';
}

async function applyExistingMigrations(targetDialect, env) {
  const runnerRoot = join(packageRoot, '.tmp');
  await mkdir(runnerRoot, { recursive: true });
  const directory = await mkdtemp(join(runnerRoot, 'issuary-migration-runner-'));
  const runnerPath = join(directory, 'apply-existing-migrations.mjs');
  const driverPackage =
    targetDialect === 'postgres' ? '@mikro-orm/postgresql' : '@mikro-orm/sql';
  const factoryImport = pathToFileURL(
    targetDialect === 'postgres'
      ? join(packageRoot, 'src/entrypoints/database/postgres/postgres.ts')
      : join(packageRoot, 'src/entrypoints/database/sqlite/sqlite.ts'),
  ).href;
  const factoryName = targetDialect === 'postgres' ? 'postgres' : 'sqlite';
  const configExpression =
    targetDialect === 'postgres'
      ? `postgres({\n          host: process.env.ISSUARY_MIGRATION_POSTGRES_HOST ?? '127.0.0.1',\n          port: Number(process.env.ISSUARY_MIGRATION_POSTGRES_PORT ?? '5432'),\n          user: process.env.ISSUARY_MIGRATION_POSTGRES_USER ?? 'issuary',\n          password: process.env.ISSUARY_MIGRATION_POSTGRES_PASSWORD ?? 'issuary',\n          name: process.env.ISSUARY_MIGRATION_POSTGRES_DB ?? 'issuary',\n          driverOptions: {},\n        })`
      : `sqlite({\n          path: process.env.ISSUARY_MIGRATION_SQLITE_DB_PATH,\n          test: false,\n        })`;

  await writeFile(
    runnerPath,
    `import { MikroORM } from '${driverPackage}';\n` +
      `import { ${factoryName} } from '${factoryImport}';\n` +
      `const cfg = ${configExpression};\n` +
      `const orm = await MikroORM.init(await cfg.getMikroOrmOptions());\n` +
      `await orm.migrator.up();\n` +
      `await orm.close(true);\n`,
  );

  try {
    run(
      'node',
      ['--conditions=@issuary/source', '--import', 'tsx', runnerPath],
      { env },
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

async function runMikroOrmMigrationCreate(targetDialect, env) {
  const configPath =
    targetDialect === 'postgres'
      ? './src/entrypoints/database/postgres/cli.ts'
      : './src/entrypoints/database/sqlite/cli.ts';
  const migrationsPath = join(packageRoot, 'src/migrations', targetDialect);
  const before = new Set(await listMigrationFiles(migrationsPath));

  run(
    'pnpm',
    ['exec', 'mikro-orm', 'migration:create', ...extraMigrationArgs, '--config', configPath],
    { env },
  );

  if (targetDialect === 'sqlite') {
    await removeKnownSqliteNoopMigration(migrationsPath, before);
  }
}

function listMigrationFiles(migrationsPath) {
  try {
    return readdir(migrationsPath, { withFileTypes: true })
      .then((entries) =>
        entries
          .filter((entry) => entry.isFile() && /^Migration\d+\.ts$/.test(entry.name))
          .map((entry) => entry.name),
      );
  } catch {
    return [];
  }
}

async function removeKnownSqliteNoopMigration(migrationsPath, before) {
  const after = await listMigrationFiles(migrationsPath);
  const created = after.filter((fileName) => !before.has(fileName));

  for (const fileName of created) {
    const filePath = join(migrationsPath, fileName);
    const content = await readFile(filePath, 'utf8');
    const isOnlyUserOAuthChurn =
      content.includes('user_oauth__temp_alter') &&
      !content.includes('oauth_device_code') &&
      !content.includes('background_jobs__temp_alter') &&
      !content.includes('scheduled_jobs__temp_alter') &&
      !content.includes('alter table `oauth_client`') &&
      !content.includes('alter table "oauth_client"');

    if (isOnlyUserOAuthChurn) {
      await rm(filePath, { force: true });
      console.warn(
        `${fileName} contained only known SQLite user_oauth rebuild churn and was removed.`,
      );
    }
  }
}

function dockerOutput(args) {
  return run('docker', args, { stdio: 'pipe' }).trim();
}

async function withSqliteBaseline(callback) {
  const directory = await mkdtemp(join(tmpdir(), 'issuary-migration-sqlite-'));
  const databasePath = join(directory, 'baseline.sqlite');
  const env = {
    ISSUARY_MIGRATION_SQLITE_DB_PATH: databasePath,
  };

  try {
    await applyExistingMigrations('sqlite', env);
    await callback(env);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

async function withPostgresBaseline(callback) {
  const externallyConfigured = Boolean(
    process.env.ISSUARY_MIGRATION_POSTGRES_HOST ||
      process.env.ISSUARY_MIGRATION_POSTGRES_PORT ||
      process.env.ISSUARY_MIGRATION_POSTGRES_DB,
  );

  if (externallyConfigured) {
    const env = {
      ISSUARY_MIGRATION_POSTGRES_HOST:
        process.env.ISSUARY_MIGRATION_POSTGRES_HOST ?? '127.0.0.1',
      ISSUARY_MIGRATION_POSTGRES_PORT:
        process.env.ISSUARY_MIGRATION_POSTGRES_PORT ?? '5432',
      ISSUARY_MIGRATION_POSTGRES_USER:
        process.env.ISSUARY_MIGRATION_POSTGRES_USER ?? 'issuary',
      ISSUARY_MIGRATION_POSTGRES_PASSWORD:
        process.env.ISSUARY_MIGRATION_POSTGRES_PASSWORD ?? 'issuary',
      ISSUARY_MIGRATION_POSTGRES_DB:
        process.env.ISSUARY_MIGRATION_POSTGRES_DB ?? 'issuary',
    };
    await applyExistingMigrations('postgres', env);
    await callback(env);
    return;
  }

  const containerName = `issuary-migration-baseline-${Date.now()}-${process.pid}`;
  const password = `issuary-migration-${process.pid}`;

  dockerOutput([
    'run',
    '--name',
    containerName,
    '-e',
    'POSTGRES_USER=issuary',
    '-e',
    `POSTGRES_PASSWORD=${password}`,
    '-e',
    'POSTGRES_DB=issuary',
    '-p',
    '127.0.0.1::5432',
    '-d',
    'postgres:17-alpine',
  ]);

  try {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const ready = spawnSync(
        'docker',
        ['exec', containerName, 'pg_isready', '-U', 'issuary', '-d', 'issuary'],
        {
          stdio: 'ignore',
        },
      );
      if ((ready.status ?? 1) === 0) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const mappedPort = dockerOutput(['port', containerName, '5432/tcp'])
      .split('\n')
      .at(0)
      ?.split(':')
      .at(-1);

    if (!mappedPort) {
      throw new Error('Could not determine Docker-mapped Postgres port.');
    }

    const env = {
      ISSUARY_MIGRATION_POSTGRES_HOST: '127.0.0.1',
      ISSUARY_MIGRATION_POSTGRES_PORT: mappedPort,
      ISSUARY_MIGRATION_POSTGRES_USER: 'issuary',
      ISSUARY_MIGRATION_POSTGRES_PASSWORD: password,
      ISSUARY_MIGRATION_POSTGRES_DB: 'issuary',
    };

    await applyExistingMigrations('postgres', env);
    await callback(env);
  } finally {
    spawnSync('docker', ['rm', '-f', containerName], {
      stdio: 'ignore',
    });
  }
}

try {
  if (dialect === 'sqlite') {
    await withSqliteBaseline(async (env) =>
      runMikroOrmMigrationCreate('sqlite', env),
    );
  } else {
    await withPostgresBaseline(async (env) =>
      runMikroOrmMigrationCreate('postgres', env),
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

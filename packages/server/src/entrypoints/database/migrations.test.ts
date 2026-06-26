import { describe, expect, test } from 'vitest';
import { POSTGRES_MIGRATIONS } from '../../migrations/postgres/index.ts';
import { Migration20260509171036_initial as PostgresInitialMigration } from '../../migrations/postgres/Migration20260509171036_initial.ts';
import { Migration20260512120000_add_scheduler_jobs as PostgresSchedulerJobsMigration } from '../../migrations/postgres/Migration20260512120000_add_scheduler_jobs.ts';
import { Migration20260619075007 as PostgresDeviceAuthorizationMigration } from '../../migrations/postgres/Migration20260619075007.js';
import { Migration20260619191600_unique_oauth_client_client_id as PostgresUniqueOAuthClientClientIdMigration } from '../../migrations/postgres/Migration20260619191600_unique_oauth_client_client_id.js';
import { Migration20260620025358_add_oauth_client_skip_consent as PostgresOAuthClientSkipConsentMigration } from '../../migrations/postgres/Migration20260620025358_add_oauth_client_skip_consent.js';
import { Migration20260624190500_add_oauth_device_denied_at as PostgresOAuthDeviceDeniedAtMigration } from '../../migrations/postgres/Migration20260624190500_add_oauth_device_denied_at.js';
import { Migration20260624223000_add_oauth_device_poll_state as PostgresOAuthDevicePollStateMigration } from '../../migrations/postgres/Migration20260624223000_add_oauth_device_poll_state.js';
import { Migration20260626103000_allow_revoked_token_without_user as PostgresRevokedTokenNullableUserMigration } from '../../migrations/postgres/Migration20260626103000_allow_revoked_token_without_user.js';
import { SQLITE_MIGRATIONS } from '../../migrations/sqlite/index.ts';
import { Migration20260509171226_initial as SqliteInitialMigration } from '../../migrations/sqlite/Migration20260509171226_initial.ts';
import { Migration20260512120000_add_scheduler_jobs as SqliteSchedulerJobsMigration } from '../../migrations/sqlite/Migration20260512120000_add_scheduler_jobs.ts';
import { Migration20260619075330 as SqliteDeviceAuthorizationMigration } from '../../migrations/sqlite/Migration20260619075330.js';
import { Migration20260619191600_unique_oauth_client_client_id as SqliteUniqueOAuthClientClientIdMigration } from '../../migrations/sqlite/Migration20260619191600_unique_oauth_client_client_id.js';
import { Migration20260620025358_add_oauth_client_skip_consent as SqliteOAuthClientSkipConsentMigration } from '../../migrations/sqlite/Migration20260620025358_add_oauth_client_skip_consent.js';
import { Migration20260624190500_add_oauth_device_denied_at as SqliteOAuthDeviceDeniedAtMigration } from '../../migrations/sqlite/Migration20260624190500_add_oauth_device_denied_at.js';
import { Migration20260624223000_add_oauth_device_poll_state as SqliteOAuthDevicePollStateMigration } from '../../migrations/sqlite/Migration20260624223000_add_oauth_device_poll_state.js';
import { Migration20260626103000_allow_revoked_token_without_user as SqliteRevokedTokenNullableUserMigration } from '../../migrations/sqlite/Migration20260626103000_allow_revoked_token_without_user.js';
import { postgres } from './postgres/postgres.ts';
import { sqlite } from './sqlite/sqlite.ts';

type MigrationClass =
  | typeof PostgresInitialMigration
  | typeof PostgresSchedulerJobsMigration
  | typeof PostgresDeviceAuthorizationMigration
  | typeof PostgresUniqueOAuthClientClientIdMigration
  | typeof PostgresOAuthClientSkipConsentMigration
  | typeof PostgresOAuthDeviceDeniedAtMigration
  | typeof PostgresOAuthDevicePollStateMigration
  | typeof PostgresRevokedTokenNullableUserMigration
  | typeof SqliteInitialMigration
  | typeof SqliteSchedulerJobsMigration
  | typeof SqliteDeviceAuthorizationMigration
  | typeof SqliteUniqueOAuthClientClientIdMigration
  | typeof SqliteOAuthClientSkipConsentMigration
  | typeof SqliteOAuthDeviceDeniedAtMigration
  | typeof SqliteOAuthDevicePollStateMigration
  | typeof SqliteRevokedTokenNullableUserMigration;

interface MigrationLike {
  up(): void | Promise<void>;
  getQueries(): Array<{ toString(): string }>;
}

async function collectMigrationQueries(
  MigrationConstructor: MigrationClass,
): Promise<string[]> {
  const migration: MigrationLike = Reflect.construct(MigrationConstructor, []);
  await migration.up();
  return migration.getQueries().map((query) => query.toString());
}

describe('database migrations', () => {
  test('postgres uses explicit migration imports', async () => {
    const options = await postgres({
      host: 'localhost',
      name: 'tinyauth',
      password: 'tinyauth',
      port: 5432,
      user: 'tinyauth',
    }).getMikroOrmOptions();

    expect(POSTGRES_MIGRATIONS).toEqual([
      PostgresInitialMigration,
      PostgresSchedulerJobsMigration,
      PostgresDeviceAuthorizationMigration,
      PostgresUniqueOAuthClientClientIdMigration,
      PostgresOAuthClientSkipConsentMigration,
      PostgresOAuthDeviceDeniedAtMigration,
      PostgresOAuthDevicePollStateMigration,
      PostgresRevokedTokenNullableUserMigration,
    ]);
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

    expect(SQLITE_MIGRATIONS).toEqual([
      SqliteInitialMigration,
      SqliteSchedulerJobsMigration,
      SqliteDeviceAuthorizationMigration,
      SqliteUniqueOAuthClientClientIdMigration,
      SqliteOAuthClientSkipConsentMigration,
      SqliteOAuthDeviceDeniedAtMigration,
      SqliteOAuthDevicePollStateMigration,
      SqliteRevokedTokenNullableUserMigration,
    ]);
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

  test('postgres initial migration creates core auth tables and constraints', async () => {
    const queries = await collectMigrationQueries(PostgresInitialMigration);
    expect(queries).toContain(
      `alter table "jwt_key" add constraint "jwt_key_status_check" check ("status" in ('next', 'active', 'previous', 'retired'));`,
    );
    expect(queries).toContain(
      `alter table "oauth_code" add constraint "oauth_code_code_challenge_method_check" check ("code_challenge_method" in ('S256', 'plain'));`,
    );
    expect(queries).toContain(
      `alter table "revoked_tokens" add constraint "revoked_tokens_token_type_check" check ("token_type" in ('access_token', 'refresh_token'));`,
    );
    expect(
      queries.some((query) => query.includes('create table "user_totp"')),
    ).toBe(true);
    expect(
      queries.some((query) =>
        query.includes('create table "pending_oauth_registration"'),
      ),
    ).toBe(true);
  });

  test('sqlite initial migration creates core auth tables and constraints', async () => {
    const queries = await collectMigrationQueries(SqliteInitialMigration);
    expect(queries).toContain(
      `create table \`jwt_key\` (\`kid\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`private_key\` text not null, \`public_key\` text not null, \`algorithm\` text not null default 'RS256', \`status\` text check (\`status\` in ('next', 'active', 'previous', 'retired')) not null default 'next', \`activated_at\` datetime null, \`deactivated_at\` datetime null, \`retired_at\` datetime null, \`expires_at\` datetime null) /* RSA key pairs for JWT signing (RS256) */;`,
    );
    expect(queries).toContain(
      `create table \`oauth_code\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`code_hash\` text not null, \`client_id\` text not null, \`user_sub\` text not null, \`redirect_uri\` text null, \`scope\` json not null default '[]', \`nonce\` text not null, \`code_challenge\` text not null, \`code_challenge_method\` text check (\`code_challenge_method\` in ('S256', 'plain')) not null default 'S256', \`expired_at\` datetime not null, \`consumed_at\` datetime null, \`auth_time\` integer null, constraint \`oauth_code_client_id_foreign\` foreign key (\`client_id\`) references \`oauth_client\` (\`id\`), constraint \`oauth_code_user_sub_foreign\` foreign key (\`user_sub\`) references \`user\` (\`sub\`)) /* Issued OAuth authorization codes */;`,
    );
    expect(
      queries.some((query) => query.includes('create table `user_totp`')),
    ).toBe(true);
    expect(
      queries.some((query) =>
        query.includes('create table `pending_oauth_registration`'),
      ),
    ).toBe(true);
  });

  test('scheduler migrations create durable lease and queue tables', async () => {
    const postgresQueries = await collectMigrationQueries(
      PostgresSchedulerJobsMigration,
    );
    const sqliteQueries = await collectMigrationQueries(
      SqliteSchedulerJobsMigration,
    );

    expect(postgresQueries).toContain(
      `create index "background_jobs_status_available_at_idx" on "background_jobs" ("status", "available_at");`,
    );
    expect(sqliteQueries).toContain(
      `create index \`background_jobs_status_available_at_idx\` on \`background_jobs\` (\`status\`, \`available_at\`);`,
    );
    expect(
      postgresQueries.some((query) =>
        query.includes('"locked_until" timestamptz null'),
      ),
    ).toBe(true);
    expect(
      sqliteQueries.some((query) =>
        query.includes('`locked_until` datetime null'),
      ),
    ).toBe(true);
  });

  test('oauth client client_id migrations replace the accidental non-unique index', async () => {
    const postgresQueries = await collectMigrationQueries(
      PostgresUniqueOAuthClientClientIdMigration,
    );
    const sqliteQueries = await collectMigrationQueries(
      SqliteUniqueOAuthClientClientIdMigration,
    );

    expect(postgresQueries).toContain(
      `drop index if exists "client_client_id_unique";`,
    );
    expect(postgresQueries).toContain(
      `create unique index "client_client_id_unique" on "oauth_client" ("client_id");`,
    );
    expect(sqliteQueries).toContain(
      `drop index if exists \`client_client_id_unique\`;`,
    );
    expect(sqliteQueries).toContain(
      `create unique index \`client_client_id_unique\` on \`oauth_client\` (\`client_id\`);`,
    );
  });

  test('oauth client skip_consent migrations add first-party consent policy column', async () => {
    const postgresQueries = await collectMigrationQueries(
      PostgresOAuthClientSkipConsentMigration,
    );
    const sqliteQueries = await collectMigrationQueries(
      SqliteOAuthClientSkipConsentMigration,
    );

    expect(postgresQueries).toContain(
      `alter table "oauth_client" add "skip_consent" boolean not null default false;`,
    );
    expect(sqliteQueries).toContain(
      `alter table \`oauth_client\` add column \`skip_consent\` integer not null default false;`,
    );
  });

  test('oauth device code deny migration adds denied_at timestamp', async () => {
    const postgresQueries = await collectMigrationQueries(
      PostgresOAuthDeviceDeniedAtMigration,
    );
    const sqliteQueries = await collectMigrationQueries(
      SqliteOAuthDeviceDeniedAtMigration,
    );

    expect(postgresQueries).toContain(
      `alter table "oauth_device_code" add "denied_at" timestamptz null;`,
    );
    expect(postgresQueries).toContain(
      `comment on column "oauth_device_code"."denied_at" is 'Timestamp when the user denied the request';`,
    );
    expect(sqliteQueries).toContain(
      `alter table \`oauth_device_code\` add column \`denied_at\` datetime null;`,
    );
  });
  test('oauth device code poll state migration stores slow_down state', async () => {
    const postgresQueries = await collectMigrationQueries(
      PostgresOAuthDevicePollStateMigration,
    );
    const sqliteQueries = await collectMigrationQueries(
      SqliteOAuthDevicePollStateMigration,
    );

    expect(postgresQueries).toContain(
      `alter table "oauth_device_code" add "last_polled_at" timestamptz null;`,
    );
    expect(postgresQueries).toContain(
      `alter table "oauth_device_code" add "poll_interval_seconds" int not null default 5;`,
    );
    expect(sqliteQueries).toContain(
      `alter table \`oauth_device_code\` add column \`last_polled_at\` datetime null;`,
    );
    expect(sqliteQueries).toContain(
      `alter table \`oauth_device_code\` add column \`poll_interval_seconds\` integer not null default 5;`,
    );
  });

  test('revoked token migration allows machine tokens without user subjects', async () => {
    const postgresQueries = await collectMigrationQueries(
      PostgresRevokedTokenNullableUserMigration,
    );
    const sqliteQueries = await collectMigrationQueries(
      SqliteRevokedTokenNullableUserMigration,
    );

    expect(postgresQueries).toContain(
      `alter table "revoked_tokens" alter column "user_sub" drop not null;`,
    );
    expect(sqliteQueries).toContain(
      "create table `revoked_tokens_temp_alter` (`id` text not null primary key, `created_at` datetime not null, `updated_at` datetime not null, `jti` text not null, `token_type` text check (`token_type` in ('access_token', 'refresh_token')) not null, `client_id` text not null, `user_sub` text null, `expires_at` datetime not null, `revoked_at` datetime not null, constraint `revoked_tokens_client_id_foreign` foreign key (`client_id`) references `oauth_client` (`id`), constraint `revoked_tokens_user_sub_foreign` foreign key (`user_sub`) references `user` (`sub`));",
    );
  });
});

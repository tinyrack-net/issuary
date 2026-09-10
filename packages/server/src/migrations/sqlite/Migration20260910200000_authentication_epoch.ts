import { Migration } from '@mikro-orm/migrations';

export class Migration20260910200000_authentication_epoch extends Migration {
  override async up(): Promise<void> {
    this.addSql(`delete from "browser_session";`);
    this.addSql(`delete from "email_verification";`);
    this.addSql(`delete from "password_reset";`);
    this.addSql(`delete from "oauth_code";`);
    this.addSql(`delete from "oauth_device_code";`);
    this.addSql(`delete from "pending_oauth_registration";`);
    this.addSql(
      `update "background_jobs" set "status" = 'failed', "payload" = 'null', "locked_by" = null, "locked_until" = null, "last_error" = 'AUTHENTICATION_EPOCH_TRANSITION', "completed_at" = CURRENT_TIMESTAMP where "job_id" = 'security.mail';`,
    );
    this.addSql(
      `update "user" set "token_epoch" = lower(hex(randomblob(16))), "sessions_invalidated_at" = CURRENT_TIMESTAMP;`,
    );
    this.preserveUserDependents();
    this.addSql(
      `create table "user_epoch_transition" ("sub" text not null primary key, "created_at" datetime not null, "updated_at" datetime not null, "email" text not null, "email_verified" integer not null default false, "password_hash" text null, "managed_by" text not null default 'database', "role" text not null default 'user', "deleted_at" datetime null, "token_epoch" text not null, "sessions_invalidated_at" datetime null, "security_revision" integer not null default 0);`,
    );
    this.addSql(
      `insert into "user_epoch_transition" ("sub","created_at","updated_at","email","email_verified","password_hash","managed_by","role","deleted_at","token_epoch","sessions_invalidated_at","security_revision") select "sub","created_at","updated_at","email","email_verified","password_hash","managed_by","role","deleted_at","token_epoch","sessions_invalidated_at","security_revision" from "user";`,
    );
    this.addSql(`drop table "user";`);
    this.addSql(`alter table "user_epoch_transition" rename to "user";`);
    this.addSql(`create unique index "user_email_unique" on "user" ("email");`);
    this.addSql(`create index "user_deleted_at_idx" on "user" ("deleted_at");`);
    this.restoreUserDependents();
    this.addSql(
      `alter table "email_verification" add column "user_epoch" text not null;`,
    );
    this.addSql(
      `alter table "password_reset" add column "user_epoch" text not null;`,
    );
    this.addSql(
      `alter table "oauth_code" add column "user_epoch" text not null;`,
    );
    this.addSql(
      `alter table "oauth_device_code" add column "user_epoch" text null;`,
    );
    this.addSql(
      `alter table "pending_oauth_registration" add column "consumed_at" datetime null;`,
    );
  }
  override async down(): Promise<void> {
    this.preserveUserDependents();
    this.addSql(
      `create table "user_epoch_transition" ("sub" text not null primary key, "created_at" datetime not null, "updated_at" datetime not null, "email" text not null, "email_verified" integer not null default false, "password_hash" text null, "managed_by" text not null default 'database', "role" text not null default 'user', "deleted_at" datetime null, "token_epoch" text null, "sessions_invalidated_at" datetime null, "security_revision" integer not null default 0);`,
    );
    this.addSql(
      `insert into "user_epoch_transition" ("sub","created_at","updated_at","email","email_verified","password_hash","managed_by","role","deleted_at","token_epoch","sessions_invalidated_at","security_revision") select "sub","created_at","updated_at","email","email_verified","password_hash","managed_by","role","deleted_at","token_epoch","sessions_invalidated_at","security_revision" from "user";`,
    );
    this.addSql(`drop table "user";`);
    this.addSql(`alter table "user_epoch_transition" rename to "user";`);
    this.addSql(`create unique index "user_email_unique" on "user" ("email");`);
    this.addSql(`create index "user_deleted_at_idx" on "user" ("deleted_at");`);
    this.restoreUserDependents();
    this.addSql(`alter table "email_verification" drop column "user_epoch";`);
    this.addSql(`alter table "password_reset" drop column "user_epoch";`);
    this.addSql(`alter table "oauth_code" drop column "user_epoch";`);
    this.addSql(`alter table "oauth_device_code" drop column "user_epoch";`);
    this.addSql(
      `alter table "pending_oauth_registration" drop column "consumed_at";`,
    );
  }

  private preserveUserDependents(): void {
    // foreign_keys cannot be disabled within the migrator transaction.
    // Preserve cascading children and check the final graph before resetting
    // SQLite's deferred DROP TABLE constraint counters.
    this.addSql('pragma defer_foreign_keys = on;');
    for (const table of [
      'user_passkey',
      'user_totp',
      'user_totp_recovery_code',
      'user_terms_consent',
    ]) {
      this.addSql(
        `create temp table "epoch_saved_${table}" as select * from "${table}";`,
      );
    }
  }

  private restoreUserDependents(): void {
    for (const table of [
      'user_passkey',
      'user_totp',
      'user_totp_recovery_code',
      'user_terms_consent',
    ]) {
      this.addSql(`delete from "${table}";`);
      this.addSql(
        `insert into "${table}" select * from "epoch_saved_${table}";`,
      );
      this.addSql(`drop table "epoch_saved_${table}";`);
    }
    this.addSql(
      'create temp table epoch_foreign_key_check (valid integer not null check (valid = 1));',
    );
    this.addSql(
      'insert into epoch_foreign_key_check select case when count(*) = 0 then 1 else 0 end from pragma_foreign_key_check;',
    );
    this.addSql('drop table epoch_foreign_key_check;');
    this.addSql('pragma defer_foreign_keys = off;');
  }
}

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
      `update "user" set "token_epoch" = gen_random_uuid()::text, "sessions_invalidated_at" = CURRENT_TIMESTAMP;`,
    );
    this.addSql(`alter table "user" alter column "token_epoch" set not null;`);
    this.addSql(
      `alter table "email_verification" add column "user_epoch" varchar(255) not null;`,
    );
    this.addSql(
      `alter table "password_reset" add column "user_epoch" varchar(255) not null;`,
    );
    this.addSql(
      `alter table "oauth_code" add column "user_epoch" varchar(255) not null;`,
    );
    this.addSql(
      `alter table "oauth_device_code" add column "user_epoch" varchar(255) null;`,
    );
    this.addSql(
      `alter table "pending_oauth_registration" add column "consumed_at" timestamptz null;`,
    );
  }
  override async down(): Promise<void> {
    this.addSql(`alter table "user" alter column "token_epoch" drop not null;`);
    this.addSql(`alter table "email_verification" drop column "user_epoch";`);
    this.addSql(`alter table "password_reset" drop column "user_epoch";`);
    this.addSql(`alter table "oauth_code" drop column "user_epoch";`);
    this.addSql(`alter table "oauth_device_code" drop column "user_epoch";`);
    this.addSql(
      `alter table "pending_oauth_registration" drop column "consumed_at";`,
    );
  }
}

import { Migration } from '@mikro-orm/migrations';

export class Migration20260910220000_flow_revocation extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "email_verification" add column "revoked_at" datetime null default null;`,
    );
    this.addSql(
      `update "email_verification" set "revoked_at" = (cast(strftime('%s', 'now') as integer) * 1000) where "verified" = 0;`,
    );
    this.addSql(
      `alter table "password_reset" add column "revoked_at" datetime null default null;`,
    );
    this.addSql(
      `update "password_reset" set "revoked_at" = (cast(strftime('%s', 'now') as integer) * 1000) where "used" = 0;`,
    );
    this.addSql(
      `alter table "oauth_code" add column "client_epoch" varchar(255) not null default '';`,
    );
    this.addSql(
      `alter table "oauth_device_code" add column "client_epoch" varchar(255) not null default '';`,
    );
    this.addSql(
      `update "background_jobs" set "status" = 'failed', "payload" = 'null', "locked_by" = null, "locked_until" = null, "last_error" = 'FLOW_REVOCATION_TRANSITION', "completed_at" = (cast(strftime('%s', 'now') as integer) * 1000) where "job_id" = 'security.mail' and "status" in ('pending', 'running');`,
    );
  }
  override async down(): Promise<void> {
    this.addSql(`alter table "email_verification" drop column "revoked_at";`);
    this.addSql(`alter table "password_reset" drop column "revoked_at";`);
    this.addSql(`alter table "oauth_code" drop column "client_epoch";`);
    this.addSql(`alter table "oauth_device_code" drop column "client_epoch";`);
  }
}

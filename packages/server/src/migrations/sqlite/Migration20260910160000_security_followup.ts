import { Migration } from '@mikro-orm/migrations';
export class Migration20260910160000_security_followup extends Migration {
  override async up(): Promise<void> {
    // Invalidate pending browser flows and sessions regardless of clock skew.
    this.addSql(`delete from "browser_session";`);
    this.addSql(
      `alter table "user" add column "security_revision" integer not null default 0;`,
    );
    this.addSql(
      `create table "oauth_grant" ("id" text not null primary key, "user_sub" text not null, "client_id" text not null, "current_refresh_jti" text null, "revoked_at" datetime null, "expires_at" datetime not null, "revision" integer not null default 0);`,
    );
    this.addSql(
      `create index "oauth_grant_expires_at_index" on "oauth_grant" ("expires_at");`,
    );
    this.addSql(
      `create index "oauth_grant_user_sub_client_id_index" on "oauth_grant" ("user_sub", "client_id");`,
    );
    this.addSql(`alter table "oauth_code" add column "grant_id" text null;`);
    this.addSql(
      `alter table "oauth_device_code" add column "grant_id" text null;`,
    );
    this.addSql(
      `update "user" set "token_epoch" = lower(hex(randomblob(16))), "sessions_invalidated_at" = CURRENT_TIMESTAMP;`,
    );
    this.addSql(`update "oauth_code" set "expired_at" = CURRENT_TIMESTAMP;`);
    this.addSql(
      `update "oauth_device_code" set "expires_at" = CURRENT_TIMESTAMP;`,
    );
  }
  override async down(): Promise<void> {
    this.addSql(`alter table "user" drop column "security_revision";`);
    this.addSql(`alter table "oauth_code" drop column "grant_id";`);
    this.addSql(`alter table "oauth_device_code" drop column "grant_id";`);
    this.addSql(`drop table "oauth_grant";`);
  }
}

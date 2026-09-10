import { Migration } from '@mikro-orm/migrations';

export class Migration20260910120000_api_security extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "user" add column "token_epoch" varchar(255) null;`,
    );
    this.addSql(
      `create table "auth_budget" ("id" varchar(255) not null primary key, "attempts" integer not null, "expires_at" datetime not null);`,
    );
    this.addSql(
      `create index "auth_budget_expires_at_index" on "auth_budget" ("expires_at");`,
    );
    this.addSql(
      `alter table "user_totp" add column "last_used_step" integer null;`,
    );
    this.addSql(
      `alter table "user" add column "sessions_invalidated_at" datetime null;`,
    );
    this.addSql(
      `create table "browser_session" ("id" varchar(255) not null primary key, "data" json not null, "revision" integer not null default 0, "expires_at" datetime not null);`,
    );
    this.addSql(
      `create index "browser_session_expires_at_index" on "browser_session" ("expires_at");`,
    );
  }
  override async down(): Promise<void> {
    this.addSql(`alter table "user" drop column "token_epoch";`);
    this.addSql(`drop table "auth_budget";`);
    this.addSql(`alter table "user_totp" drop column "last_used_step";`);
    this.addSql(`drop table "browser_session";`);
    this.addSql(`alter table "user" drop column "sessions_invalidated_at";`);
  }
}

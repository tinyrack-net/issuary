import { Migration } from '@mikro-orm/migrations';

export class Migration20260518120000_add_oauth_provider extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "oauth_provider" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "type" varchar(255) not null, "issuer" varchar(255) null, "display_name" varchar(255) not null, "icon_url" varchar(255) null, "client_id" varchar(255) not null, "client_secret_encrypted" varchar(255) not null, "scopes" jsonb not null default '[]', "authorization_url" varchar(255) not null, "token_url" varchar(255) not null, "userinfo_url" varchar(255) null, "jwks_url" varchar(255) null, "email_url" varchar(255) null, "response_mode" varchar(255) null, "email_conflict_strategy" varchar(255) not null default 'auto_link', "userinfo_mapping" jsonb not null, "enabled" boolean not null default true, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "oauth_provider" is 'Database-managed OAuth identity providers';`,
    );
    this.addSql(
      `create index "oauth_provider_display_name_idx" on "oauth_provider" ("display_name", "id");`,
    );
  }
}

import { Migration } from '@mikro-orm/migrations';

export class Migration20261029120000_resource_indicators extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "oauth_code" add column "resources" jsonb not null default '[]';`,
    );
    this.addSql(
      `comment on column "oauth_code"."resources" is 'RFC 8707 resource indicators approved by the authorization request';`,
    );
    this.addSql(
      `alter table "oauth_grant" add column "resources" jsonb not null default '[]';`,
    );
  }
  override async down(): Promise<void> {
    this.addSql(`alter table "oauth_code" drop column "resources";`);
    this.addSql(`alter table "oauth_grant" drop column "resources";`);
  }
}

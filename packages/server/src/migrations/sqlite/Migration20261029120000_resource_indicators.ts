import { Migration } from '@mikro-orm/migrations';

export class Migration20261029120000_resource_indicators extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "oauth_code" add column "resources" json not null default '[]';`,
    );
    this.addSql(
      `alter table "oauth_grant" add column "resources" json not null default '[]';`,
    );
  }
  override async down(): Promise<void> {
    this.addSql(`alter table "oauth_code" drop column "resources";`);
    this.addSql(`alter table "oauth_grant" drop column "resources";`);
  }
}

import { Migration } from '@mikro-orm/migrations';

export class Migration20260624190500_add_oauth_device_denied_at extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table "oauth_device_code" add "denied_at" timestamptz null;`,
    );
    this.addSql(
      `comment on column "oauth_device_code"."denied_at" is 'Timestamp when the user denied the request';`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "oauth_device_code" drop column "denied_at";`);
  }
}

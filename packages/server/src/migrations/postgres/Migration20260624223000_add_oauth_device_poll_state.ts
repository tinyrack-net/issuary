import { Migration } from '@mikro-orm/migrations';

export class Migration20260624223000_add_oauth_device_poll_state extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table "oauth_device_code" add "last_polled_at" timestamptz null;`,
    );
    this.addSql(
      `alter table "oauth_device_code" add "poll_interval_seconds" int not null default 5;`,
    );
    this.addSql(
      `comment on column "oauth_device_code"."last_polled_at" is 'Timestamp of the most recent device token polling request';`,
    );
    this.addSql(
      `comment on column "oauth_device_code"."poll_interval_seconds" is 'Current required polling interval for this device code';`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "oauth_device_code" drop column "poll_interval_seconds";`,
    );
    this.addSql(
      `alter table "oauth_device_code" drop column "last_polled_at";`,
    );
  }
}

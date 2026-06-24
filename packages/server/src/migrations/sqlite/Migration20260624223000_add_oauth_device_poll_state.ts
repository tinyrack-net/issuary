import { Migration } from '@mikro-orm/migrations';

export class Migration20260624223000_add_oauth_device_poll_state extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`oauth_device_code\` add column \`last_polled_at\` datetime null;`,
    );
    this.addSql(
      `alter table \`oauth_device_code\` add column \`poll_interval_seconds\` integer not null default 5;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table \`oauth_device_code\` drop column \`poll_interval_seconds\`;`,
    );
    this.addSql(
      `alter table \`oauth_device_code\` drop column \`last_polled_at\`;`,
    );
  }
}

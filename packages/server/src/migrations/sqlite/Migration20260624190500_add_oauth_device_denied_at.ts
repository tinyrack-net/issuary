import { Migration } from '@mikro-orm/migrations';

export class Migration20260624190500_add_oauth_device_denied_at extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`oauth_device_code\` add column \`denied_at\` datetime null;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`oauth_device_code\` drop column \`denied_at\`;`);
  }
}

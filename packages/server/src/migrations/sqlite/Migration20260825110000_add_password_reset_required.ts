import { Migration } from '@mikro-orm/migrations';

export class Migration20260825110000_add_password_reset_required extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`user\` add column \`password_reset_required\` integer not null default false;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table \`user\` drop column \`password_reset_required\`;`,
    );
  }
}

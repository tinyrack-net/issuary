import { Migration } from '@mikro-orm/migrations';

export class Migration20260620025358_add_oauth_client_skip_consent extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table \`oauth_client\` add column \`skip_consent\` integer not null default false;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`oauth_client\` drop column \`skip_consent\`;`);
  }
}

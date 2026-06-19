import { Migration } from '@mikro-orm/migrations';

export class Migration20260619191600_unique_oauth_client_client_id extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`drop index if exists \`client_client_id_unique\`;`);
    this.addSql(
      `create unique index \`client_client_id_unique\` on \`oauth_client\` (\`client_id\`);`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop index if exists \`client_client_id_unique\`;`);
    this.addSql(
      `create index \`client_client_id_unique\` on \`oauth_client\` (\`client_id\`);`,
    );
  }
}

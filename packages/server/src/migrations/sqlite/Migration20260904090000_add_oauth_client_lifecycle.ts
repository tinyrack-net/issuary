import { Migration } from '@mikro-orm/migrations';

export class Migration20260904090000_add_oauth_client_lifecycle extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table \`oauth_client\` add column \`deleted_at\` datetime null;`,
    );
    this.addSql(
      `alter table \`oauth_client\` add column \`token_epoch\` text null;`,
    );
    this.addSql(
      `create index \`oauth_client_deleted_at_idx\` on \`oauth_client\` (\`deleted_at\`);`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index \`oauth_client_deleted_at_idx\`;`);
    this.addSql(`alter table \`oauth_client\` drop column \`deleted_at\`;`);
    this.addSql(`alter table \`oauth_client\` drop column \`token_epoch\`;`);
  }
}

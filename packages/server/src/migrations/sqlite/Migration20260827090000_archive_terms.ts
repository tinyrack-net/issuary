import { Migration } from '@mikro-orm/migrations';

export class Migration20260827090000_archive_terms extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table \`terms\` add column \`archived_at\` datetime null;`,
    );
    this.addSql(
      `create index \`terms_archived_at_idx\` on \`terms\` (\`archived_at\`);`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index \`terms_archived_at_idx\`;`);
    this.addSql(`alter table \`terms\` drop column \`archived_at\`;`);
  }
}

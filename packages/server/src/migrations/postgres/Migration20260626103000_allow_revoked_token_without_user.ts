import { Migration } from '@mikro-orm/migrations';

export class Migration20260626103000_allow_revoked_token_without_user extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table "revoked_tokens" alter column "user_sub" drop not null;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "revoked_tokens" alter column "user_sub" set not null;`,
    );
  }
}

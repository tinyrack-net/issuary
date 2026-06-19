import { Migration } from '@mikro-orm/migrations';

export class Migration20260620025358_add_oauth_client_skip_consent extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table "oauth_client" add "skip_consent" boolean not null default false;`,
    );
    this.addSql(
      `comment on column "oauth_client"."skip_consent" is 'Whether this OAuth client can skip the consent screen unless prompt=consent is requested';`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "oauth_client" drop column "skip_consent";`);
  }
}

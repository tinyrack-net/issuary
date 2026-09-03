import { Migration } from '@mikro-orm/migrations';

export class Migration20260904090000_add_oauth_client_lifecycle extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "oauth_client" add column "deleted_at" timestamptz null, add column "token_epoch" varchar(255) null;`,
    );
    this.addSql(
      `comment on column "oauth_client"."deleted_at" is 'Timestamp when the OAuth client was soft-deleted';`,
    );
    this.addSql(
      `comment on column "oauth_client"."token_epoch" is 'Opaque token generation used to invalidate previously issued tokens';`,
    );
    this.addSql(
      `create index "oauth_client_deleted_at_idx" on "oauth_client" ("deleted_at");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "oauth_client_deleted_at_idx";`);
    this.addSql(
      `alter table "oauth_client" drop column "deleted_at", drop column "token_epoch";`,
    );
  }
}

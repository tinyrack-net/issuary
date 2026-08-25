import { Migration } from '@mikro-orm/migrations';

export class Migration20260825110000_add_password_reset_required extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table "user" add column "password_reset_required" boolean not null default false;`,
    );
    this.addSql(
      `comment on column "user"."password_reset_required" is 'Whether the user must set a new password before authentication';`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "user" drop column "password_reset_required";`);
  }
}

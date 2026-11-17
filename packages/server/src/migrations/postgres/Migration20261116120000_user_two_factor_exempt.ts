import { Migration } from '@mikro-orm/migrations';

export class Migration20261116120000_user_two_factor_exempt extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "user" add column "two_factor_exempt" boolean not null default false;`,
    );
    this.addSql(
      `comment on column "user"."two_factor_exempt" is 'Whether an administrator exempted this user from required two-factor enrollment';`,
    );
  }
  override async down(): Promise<void> {
    this.addSql(`alter table "user" drop column "two_factor_exempt";`);
  }
}

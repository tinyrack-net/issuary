import { Migration } from '@mikro-orm/migrations';

export class Migration20260825140000_drop_password_reset_required extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table \`legacy_v1_removal_gate\` (\`remaining\` integer not null check (\`remaining\` = 0));`,
    );
    this.addSql(`insert into \`legacy_v1_removal_gate\` (\`remaining\`)
      select
        (select count(*) from \`user\` where \`password_reset_required\` or \`password_hash\` like '%$v=1$%') +
        (select count(*) from \`oauth_client\` where \`client_secret_hash\` like '%$v=1$%') +
        (select count(*) from \`user_totp_recovery_code\` where \`code_hash\` like '%$v=1$%') +
        (select count(*) from \`oauth_code\` where \`code_hash\` like '%$v=1$%') +
        (select count(*) from \`oauth_device_code\` where \`device_code_hash\` like '%$v=1$%' or \`user_code_hash\` like '%$v=1$%');`);
    this.addSql(`drop table \`legacy_v1_removal_gate\`;`);
    this.addSql(
      `alter table \`user\` drop column \`password_reset_required\`;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table \`user\` add column \`password_reset_required\` integer not null default false;`,
    );
  }
}

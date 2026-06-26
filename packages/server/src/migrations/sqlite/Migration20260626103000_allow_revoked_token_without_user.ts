import { Migration } from '@mikro-orm/migrations';

export class Migration20260626103000_allow_revoked_token_without_user extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table \`revoked_tokens_temp_alter\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`jti\` text not null, \`token_type\` text check (\`token_type\` in ('access_token', 'refresh_token')) not null, \`client_id\` text not null, \`user_sub\` text null, \`expires_at\` datetime not null, \`revoked_at\` datetime not null, constraint \`revoked_tokens_client_id_foreign\` foreign key (\`client_id\`) references \`oauth_client\` (\`id\`), constraint \`revoked_tokens_user_sub_foreign\` foreign key (\`user_sub\`) references \`user\` (\`sub\`));`,
    );
    this.addSql(
      `insert into \`revoked_tokens_temp_alter\` select * from \`revoked_tokens\`;`,
    );
    this.addSql(`drop table \`revoked_tokens\`;`);
    this.addSql(
      `alter table \`revoked_tokens_temp_alter\` rename to \`revoked_tokens\`;`,
    );
    this.addSql(
      `create unique index \`revoked_tokens_jti_unique\` on \`revoked_tokens\` (\`jti\`);`,
    );
    this.addSql(
      `create index \`revoked_tokens_client_id_index\` on \`revoked_tokens\` (\`client_id\`);`,
    );
    this.addSql(
      `create index \`revoked_tokens_user_sub_index\` on \`revoked_tokens\` (\`user_sub\`);`,
    );
    this.addSql(
      `create index \`revoked_token_jti_idx\` on \`revoked_tokens\` (\`jti\`);`,
    );
    this.addSql(
      `create index \`revoked_token_client_user_idx\` on \`revoked_tokens\` (\`client_id\`, \`user_sub\`);`,
    );
    this.addSql(
      `create index \`revoked_token_expires_at_idx\` on \`revoked_tokens\` (\`expires_at\`);`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `create table \`revoked_tokens_temp_alter\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`jti\` text not null, \`token_type\` text check (\`token_type\` in ('access_token', 'refresh_token')) not null, \`client_id\` text not null, \`user_sub\` text not null, \`expires_at\` datetime not null, \`revoked_at\` datetime not null, constraint \`revoked_tokens_client_id_foreign\` foreign key (\`client_id\`) references \`oauth_client\` (\`id\`), constraint \`revoked_tokens_user_sub_foreign\` foreign key (\`user_sub\`) references \`user\` (\`sub\`));`,
    );
    this.addSql(
      `insert into \`revoked_tokens_temp_alter\` select * from \`revoked_tokens\` where \`user_sub\` is not null;`,
    );
    this.addSql(`drop table \`revoked_tokens\`;`);
    this.addSql(
      `alter table \`revoked_tokens_temp_alter\` rename to \`revoked_tokens\`;`,
    );
    this.addSql(
      `create unique index \`revoked_tokens_jti_unique\` on \`revoked_tokens\` (\`jti\`);`,
    );
    this.addSql(
      `create index \`revoked_tokens_client_id_index\` on \`revoked_tokens\` (\`client_id\`);`,
    );
    this.addSql(
      `create index \`revoked_tokens_user_sub_index\` on \`revoked_tokens\` (\`user_sub\`);`,
    );
    this.addSql(
      `create index \`revoked_token_jti_idx\` on \`revoked_tokens\` (\`jti\`);`,
    );
    this.addSql(
      `create index \`revoked_token_client_user_idx\` on \`revoked_tokens\` (\`client_id\`, \`user_sub\`);`,
    );
    this.addSql(
      `create index \`revoked_token_expires_at_idx\` on \`revoked_tokens\` (\`expires_at\`);`,
    );
  }
}

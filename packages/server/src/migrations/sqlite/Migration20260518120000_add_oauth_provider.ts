import { Migration } from '@mikro-orm/migrations';

export class Migration20260518120000_add_oauth_provider extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table \`oauth_provider\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`type\` text not null, \`issuer\` text null, \`display_name\` text not null, \`icon_url\` text null, \`client_id\` text not null, \`client_secret_encrypted\` text not null, \`scopes\` json not null default '[]', \`authorization_url\` text not null, \`token_url\` text not null, \`userinfo_url\` text null, \`jwks_url\` text null, \`email_url\` text null, \`response_mode\` text null, \`email_conflict_strategy\` text not null default 'auto_link', \`userinfo_mapping\` json not null, \`enabled\` integer not null default true) /* Database-managed OAuth identity providers */;`,
    );
    this.addSql(
      `create index \`oauth_provider_display_name_idx\` on \`oauth_provider\` (\`display_name\`, \`id\`);`,
    );
  }
}

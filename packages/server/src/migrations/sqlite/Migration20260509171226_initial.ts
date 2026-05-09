import { Migration } from '@mikro-orm/migrations';

export class Migration20260509171226_initial extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table \`bootstrap_state\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`value\` text not null) /* Runtime bootstrap metadata */;`,
    );

    this.addSql(
      `create table \`jwt_key\` (\`kid\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`private_key\` text not null, \`public_key\` text not null, \`algorithm\` text not null default 'RS256', \`status\` text check (\`status\` in ('next', 'active', 'previous', 'retired')) not null default 'next', \`activated_at\` datetime null, \`deactivated_at\` datetime null, \`retired_at\` datetime null, \`expires_at\` datetime null) /* RSA key pairs for JWT signing (RS256) */;`,
    );
    this.addSql(
      `create index \`jwt_key_status_idx\` on \`jwt_key\` (\`status\`);`,
    );

    this.addSql(
      `create table \`oauth_client\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`client_id\` text not null, \`client_secret_hash\` text null, \`name\` text not null, \`grant_types\` json not null default '[]', \`response_types\` json not null default '[]', \`scopes\` json not null default '[]', \`redirect_uris\` json not null default '[]', \`enabled\` integer not null default true, \`managed_by\` text not null default 'database', \`logo_uri\` text null) /* Registered OAuth clients */;`,
    );
    this.addSql(
      `create index \`client_client_id_unique\` on \`oauth_client\` (\`client_id\`);`,
    );

    this.addSql(
      `create table \`pending_oauth_registration\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`token\` text not null, \`provider_id\` text not null, \`access_token\` text not null, \`refresh_token\` text null, \`expires_in\` integer null, \`token_type\` text not null, \`user_info\` json not null, \`return_url\` text null, \`expires_at\` datetime not null) /* Server-side store for pending OAuth registrations awaiting terms consent */;`,
    );
    this.addSql(
      `create unique index \`pending_oauth_registration_token_unique\` on \`pending_oauth_registration\` (\`token\`);`,
    );
    this.addSql(
      `create index \`pending_oauth_reg_token_idx\` on \`pending_oauth_registration\` (\`token\`);`,
    );
    this.addSql(
      `create index \`pending_oauth_reg_expires_at_idx\` on \`pending_oauth_registration\` (\`expires_at\`);`,
    );

    this.addSql(
      `create table \`terms\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`required\` integer not null default true, \`consent_mode\` text not null default 'explicit', \`version\` text not null, \`managed_by\` text not null default 'database') /* Terms of service definitions */;`,
    );

    this.addSql(
      `create table \`terms_content\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`terms_id\` text not null, \`lang\` text not null, \`title\` text not null, \`type\` text not null default 'link', \`content\` text not null, constraint \`terms_content_terms_id_foreign\` foreign key (\`terms_id\`) references \`terms\` (\`id\`) on delete cascade) /* Localized content for terms */;`,
    );
    this.addSql(
      `create index \`terms_content_terms_id_index\` on \`terms_content\` (\`terms_id\`);`,
    );
    this.addSql(
      `create unique index \`terms_content_terms_lang_unique\` on \`terms_content\` (\`terms_id\`, \`lang\`);`,
    );

    this.addSql(
      `create table \`user\` (\`sub\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`email\` text not null, \`email_verified\` integer not null default false, \`password_hash\` text null, \`managed_by\` text not null default 'database', \`role\` text not null default 'user', \`deleted_at\` datetime null) /* Registered users */;`,
    );
    this.addSql(`create index \`user_email_unique\` on \`user\` (\`email\`);`);
    this.addSql(
      `create index \`user_deleted_at_idx\` on \`user\` (\`deleted_at\`);`,
    );

    this.addSql(
      `create table \`user_consent\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`user_sub\` text not null, \`client_id\` text not null, \`scopes\` json not null default '[]', \`granted_at\` datetime not null, \`revoked_at\` datetime null, constraint \`user_consent_user_sub_foreign\` foreign key (\`user_sub\`) references \`user\` (\`sub\`), constraint \`user_consent_client_id_foreign\` foreign key (\`client_id\`) references \`oauth_client\` (\`id\`)) /* User consent decisions for OAuth clients */;`,
    );
    this.addSql(
      `create index \`user_consent_user_sub_index\` on \`user_consent\` (\`user_sub\`);`,
    );
    this.addSql(
      `create index \`user_consent_client_id_index\` on \`user_consent\` (\`client_id\`);`,
    );
    this.addSql(
      `create unique index \`user_consent_unique\` on \`user_consent\` (\`user_sub\`, \`client_id\`);`,
    );

    this.addSql(
      `create table \`revoked_tokens\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`jti\` text not null, \`token_type\` text check (\`token_type\` in ('access_token', 'refresh_token')) not null, \`client_id\` text not null, \`user_sub\` text not null, \`expires_at\` datetime not null, \`revoked_at\` datetime not null, constraint \`revoked_tokens_client_id_foreign\` foreign key (\`client_id\`) references \`oauth_client\` (\`id\`), constraint \`revoked_tokens_user_sub_foreign\` foreign key (\`user_sub\`) references \`user\` (\`sub\`)) /* Revoked OAuth tokens for invalidation before expiry */;`,
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

    this.addSql(
      `create table \`password_reset\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`user_sub\` text not null, \`token\` text not null, \`expires_at\` datetime not null, \`used\` integer not null default false, \`used_at\` datetime null, constraint \`password_reset_user_sub_foreign\` foreign key (\`user_sub\`) references \`user\` (\`sub\`)) /* Password reset tokens for user password recovery */;`,
    );
    this.addSql(
      `create index \`password_reset_user_sub_idx\` on \`password_reset\` (\`user_sub\`);`,
    );
    this.addSql(
      `create index \`password_reset_token_idx\` on \`password_reset\` (\`token\`);`,
    );

    this.addSql(
      `create table \`oauth_code\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`code_hash\` text not null, \`client_id\` text not null, \`user_sub\` text not null, \`redirect_uri\` text null, \`scope\` json not null default '[]', \`nonce\` text not null, \`code_challenge\` text not null, \`code_challenge_method\` text check (\`code_challenge_method\` in ('S256', 'plain')) not null default 'S256', \`expired_at\` datetime not null, \`consumed_at\` datetime null, \`auth_time\` integer null, constraint \`oauth_code_client_id_foreign\` foreign key (\`client_id\`) references \`oauth_client\` (\`id\`), constraint \`oauth_code_user_sub_foreign\` foreign key (\`user_sub\`) references \`user\` (\`sub\`)) /* Issued OAuth authorization codes */;`,
    );
    this.addSql(
      `create unique index \`oauth_code_code_hash_unique\` on \`oauth_code\` (\`code_hash\`);`,
    );
    this.addSql(
      `create index \`oauth_code_client_id_index\` on \`oauth_code\` (\`client_id\`);`,
    );
    this.addSql(
      `create index \`oauth_code_user_sub_index\` on \`oauth_code\` (\`user_sub\`);`,
    );
    this.addSql(
      `create index \`auth_code_hash_idx\` on \`oauth_code\` (\`code_hash\`);`,
    );
    this.addSql(
      `create index \`oauth_code_client_consumed_idx\` on \`oauth_code\` (\`client_id\`, \`consumed_at\`);`,
    );
    this.addSql(
      `create index \`oauth_code_expired_at_idx\` on \`oauth_code\` (\`expired_at\`);`,
    );

    this.addSql(
      `create table \`email_verification\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`user_sub\` text not null, \`token\` text not null, \`expires_at\` datetime not null, \`verified\` integer not null default false, \`verified_at\` datetime null, constraint \`email_verification_user_sub_foreign\` foreign key (\`user_sub\`) references \`user\` (\`sub\`)) /* Email verification tokens for user registration */;`,
    );
    this.addSql(
      `create index \`email_verification_user_sub_idx\` on \`email_verification\` (\`user_sub\`);`,
    );
    this.addSql(
      `create index \`email_verification_token_idx\` on \`email_verification\` (\`token\`);`,
    );

    this.addSql(
      `create table \`user_oauth\` (\`id\` integer not null primary key autoincrement, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`user_sub\` text not null, \`provider_name\` text not null, \`provider_user_id\` text not null, \`access_token\` text not null, \`refresh_token\` text not null, \`expires_at\` datetime null, constraint \`user_oauth_user_sub_foreign\` foreign key (\`user_sub\`) references \`user\` (\`sub\`)) /* OAuth accounts linked to users */;`,
    );
    this.addSql(
      `create index \`user_oauth_user_sub_idx\` on \`user_oauth\` (\`user_sub\`);`,
    );
    this.addSql(
      `create index \`user_oauth_user_provider_idx\` on \`user_oauth\` (\`user_sub\`, \`provider_name\`);`,
    );
    this.addSql(
      `create unique index \`user_oauth_provider_unique\` on \`user_oauth\` (\`provider_name\`, \`provider_user_id\`);`,
    );

    this.addSql(
      `create table \`user_passkey\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`user_sub\` text not null, \`credential_id\` text not null, \`public_key\` text not null, \`counter\` integer not null default 0, \`device_type\` text not null default 'singleDevice', \`backed_up\` integer not null default false, \`transports\` json null, \`name\` text null, \`aaguid\` text null, constraint \`user_passkey_user_sub_foreign\` foreign key (\`user_sub\`) references \`user\` (\`sub\`) on delete cascade) /* User passkeys for WebAuthn authentication */;`,
    );
    this.addSql(
      `create index \`user_passkey_user_sub_idx\` on \`user_passkey\` (\`user_sub\`);`,
    );
    this.addSql(
      `create index \`user_passkey_credential_id_unique\` on \`user_passkey\` (\`credential_id\`);`,
    );

    this.addSql(
      `create table \`user_terms_consent\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`user_sub\` text not null, \`terms_id\` text not null, \`terms_version\` text not null, \`agreed\` integer not null, \`consent_type\` text not null, \`agreed_at\` datetime not null, constraint \`user_terms_consent_user_sub_foreign\` foreign key (\`user_sub\`) references \`user\` (\`sub\`) on delete cascade, constraint \`user_terms_consent_terms_id_foreign\` foreign key (\`terms_id\`) references \`terms\` (\`id\`) on delete cascade) /* User consent records for terms of service */;`,
    );
    this.addSql(
      `create index \`user_terms_consent_user_sub_index\` on \`user_terms_consent\` (\`user_sub\`);`,
    );
    this.addSql(
      `create index \`user_terms_consent_terms_id_index\` on \`user_terms_consent\` (\`terms_id\`);`,
    );
    this.addSql(
      `create index \`user_terms_consent_user_terms_index\` on \`user_terms_consent\` (\`user_sub\`, \`terms_id\`);`,
    );

    this.addSql(
      `create table \`user_totp\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`user_sub\` text not null, \`secret\` text not null, \`verified\` integer not null default false, \`recovery_confirmed\` integer not null default false, constraint \`user_totp_user_sub_foreign\` foreign key (\`user_sub\`) references \`user\` (\`sub\`) on delete cascade) /* User TOTP secrets for two-factor authentication */;`,
    );
    this.addSql(
      `create index \`user_totp_user_sub_index\` on \`user_totp\` (\`user_sub\`);`,
    );
    this.addSql(
      `create unique index \`user_totp_user_unique\` on \`user_totp\` (\`user_sub\`);`,
    );

    this.addSql(
      `create table \`user_totp_recovery_code\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`user_sub\` text not null, \`code_hash\` text not null, \`used\` integer not null default false, \`used_at\` datetime null, constraint \`user_totp_recovery_code_user_sub_foreign\` foreign key (\`user_sub\`) references \`user\` (\`sub\`) on delete cascade) /* One-time recovery codes for TOTP two-factor authentication */;`,
    );
    this.addSql(
      `create index \`user_totp_recovery_code_user_sub_idx\` on \`user_totp_recovery_code\` (\`user_sub\`);`,
    );
  }
}

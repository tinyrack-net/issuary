import { Migration } from '@mikro-orm/migrations';

export class Migration20260509171036_initial extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "bootstrap_state" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "value" varchar(255) not null, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "bootstrap_state" is 'Runtime bootstrap metadata';`,
    );
    this.addSql(
      `comment on column "bootstrap_state"."id" is 'Bootstrap metadata key';`,
    );
    this.addSql(
      `comment on column "bootstrap_state"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "bootstrap_state"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "bootstrap_state"."value" is 'Bootstrap metadata value';`,
    );

    this.addSql(
      `create table "jwt_key" ("kid" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "private_key" text not null, "public_key" text not null, "algorithm" varchar(255) not null default 'RS256', "status" text not null default 'next', "activated_at" timestamptz null, "deactivated_at" timestamptz null, "retired_at" timestamptz null, "expires_at" timestamptz null, primary key ("kid"));`,
    );
    this.addSql(
      `comment on table "jwt_key" is 'RSA key pairs for JWT signing (RS256)';`,
    );
    this.addSql(
      `comment on column "jwt_key"."kid" is 'Key ID for JWT header (kid claim)';`,
    );
    this.addSql(
      `comment on column "jwt_key"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "jwt_key"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "jwt_key"."private_key" is 'RSA private key in PEM format';`,
    );
    this.addSql(
      `comment on column "jwt_key"."public_key" is 'RSA public key in PEM format';`,
    );
    this.addSql(
      `comment on column "jwt_key"."algorithm" is 'JWT signing algorithm (RS256)';`,
    );
    this.addSql(
      `comment on column "jwt_key"."status" is 'Key status: next, active, previous, retired';`,
    );
    this.addSql(
      `comment on column "jwt_key"."activated_at" is 'When the key was activated for signing';`,
    );
    this.addSql(
      `comment on column "jwt_key"."deactivated_at" is 'When the key was deactivated from signing';`,
    );
    this.addSql(
      `comment on column "jwt_key"."retired_at" is 'When the key was fully retired';`,
    );
    this.addSql(
      `comment on column "jwt_key"."expires_at" is 'Scheduled expiration for automatic rotation';`,
    );
    this.addSql(`create index "jwt_key_status_idx" on "jwt_key" ("status");`);
    this.addSql(
      `alter table "jwt_key" add constraint "jwt_key_status_check" check ("status" in ('next', 'active', 'previous', 'retired'));`,
    );

    this.addSql(
      `create table "oauth_client" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "client_id" varchar(255) not null, "client_secret_hash" varchar(255) null, "name" varchar(255) not null, "grant_types" jsonb not null default '[]', "response_types" jsonb not null default '[]', "scopes" jsonb not null default '[]', "redirect_uris" jsonb not null default '[]', "enabled" boolean not null default true, "managed_by" varchar(255) not null default 'database', "logo_uri" varchar(255) null, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "oauth_client" is 'Registered OAuth clients';`,
    );
    this.addSql(
      `comment on column "oauth_client"."id" is 'Primary key as UUID';`,
    );
    this.addSql(
      `comment on column "oauth_client"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "oauth_client"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "oauth_client"."client_id" is 'Public client identifier';`,
    );
    this.addSql(
      `comment on column "oauth_client"."client_secret_hash" is 'Hash of the client secret (null for public clients using PKCE)';`,
    );
    this.addSql(
      `comment on column "oauth_client"."name" is 'Human-readable name of the OAuth client';`,
    );
    this.addSql(
      `comment on column "oauth_client"."grant_types" is 'Allowed OAuth grant types for the client';`,
    );
    this.addSql(
      `comment on column "oauth_client"."response_types" is 'Allowed OAuth response types for the client';`,
    );
    this.addSql(
      `comment on column "oauth_client"."scopes" is 'Allowed OAuth scopes for the client';`,
    );
    this.addSql(
      `comment on column "oauth_client"."redirect_uris" is 'Registered redirect URIs for the client';`,
    );
    this.addSql(
      `comment on column "oauth_client"."enabled" is 'Whether the OAuth client is enabled';`,
    );
    this.addSql(
      `comment on column "oauth_client"."managed_by" is 'Data source: config (from YAML) or database (runtime created)';`,
    );
    this.addSql(
      `comment on column "oauth_client"."logo_uri" is 'Logo URI for the OAuth client';`,
    );
    this.addSql(
      `create index "client_client_id_unique" on "oauth_client" ("client_id");`,
    );

    this.addSql(
      `create table "pending_oauth_registration" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "token" varchar(255) not null, "provider_id" varchar(255) not null, "access_token" text not null, "refresh_token" text null, "expires_in" int null, "token_type" varchar(255) not null, "user_info" jsonb not null, "return_url" varchar(255) null, "expires_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "pending_oauth_registration" is 'Server-side store for pending OAuth registrations awaiting terms consent';`,
    );
    this.addSql(
      `comment on column "pending_oauth_registration"."id" is 'Primary key as UUID';`,
    );
    this.addSql(
      `comment on column "pending_oauth_registration"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "pending_oauth_registration"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "pending_oauth_registration"."token" is 'Unique lookup token stored in the session cookie';`,
    );
    this.addSql(
      `comment on column "pending_oauth_registration"."provider_id" is 'OAuth provider identifier';`,
    );
    this.addSql(
      `comment on column "pending_oauth_registration"."access_token" is 'OAuth access token from the provider';`,
    );
    this.addSql(
      `comment on column "pending_oauth_registration"."refresh_token" is 'OAuth refresh token from the provider';`,
    );
    this.addSql(
      `comment on column "pending_oauth_registration"."expires_in" is 'Token expiration duration in seconds';`,
    );
    this.addSql(
      `comment on column "pending_oauth_registration"."token_type" is 'OAuth token type (e.g. Bearer)';`,
    );
    this.addSql(
      `comment on column "pending_oauth_registration"."user_info" is 'Normalized user info from the OAuth provider';`,
    );
    this.addSql(
      `comment on column "pending_oauth_registration"."return_url" is 'URL to redirect to after registration completes';`,
    );
    this.addSql(
      `comment on column "pending_oauth_registration"."expires_at" is 'Absolute expiry timestamp for this pending registration';`,
    );
    this.addSql(
      `alter table "pending_oauth_registration" add constraint "pending_oauth_registration_token_unique" unique ("token");`,
    );
    this.addSql(
      `create index "pending_oauth_reg_token_idx" on "pending_oauth_registration" ("token");`,
    );
    this.addSql(
      `create index "pending_oauth_reg_expires_at_idx" on "pending_oauth_registration" ("expires_at");`,
    );

    this.addSql(
      `create table "terms" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "required" boolean not null default true, "consent_mode" varchar(255) not null default 'explicit', "version" varchar(255) not null, "managed_by" varchar(255) not null default 'database', primary key ("id"));`,
    );
    this.addSql(`comment on table "terms" is 'Terms of service definitions';`);
    this.addSql(
      `comment on column "terms"."id" is 'Unique identifier (e.g., "tos", "privacy")';`,
    );
    this.addSql(
      `comment on column "terms"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "terms"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "terms"."required" is 'Whether agreement is mandatory';`,
    );
    this.addSql(
      `comment on column "terms"."consent_mode" is 'Consent mode: explicit (checkbox) or implicit (auto-agree)';`,
    );
    this.addSql(
      `comment on column "terms"."version" is 'Version string (e.g., "1.0.0")';`,
    );
    this.addSql(
      `comment on column "terms"."managed_by" is 'Data source: config or database';`,
    );

    this.addSql(
      `create table "terms_content" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "terms_id" varchar(255) not null, "lang" varchar(255) not null, "title" varchar(255) not null, "type" varchar(255) not null default 'link', "content" text not null, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "terms_content" is 'Localized content for terms';`,
    );
    this.addSql(
      `comment on column "terms_content"."id" is 'Primary key as UUID';`,
    );
    this.addSql(
      `comment on column "terms_content"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "terms_content"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "terms_content"."terms_id" is 'Reference to the terms';`,
    );
    this.addSql(
      `comment on column "terms_content"."lang" is 'Language code (e.g., "en", "ko", "ja")';`,
    );
    this.addSql(
      `comment on column "terms_content"."title" is 'Display title';`,
    );
    this.addSql(
      `comment on column "terms_content"."type" is 'Content type: link or text';`,
    );
    this.addSql(
      `comment on column "terms_content"."content" is 'Content value (URL if type=link, text if type=text)';`,
    );
    this.addSql(
      `alter table "terms_content" add constraint "terms_content_terms_lang_unique" unique ("terms_id", "lang");`,
    );

    this.addSql(
      `create table "user" ("sub" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "email" varchar(255) not null, "email_verified" boolean not null default false, "password_hash" varchar(255) null, "managed_by" varchar(255) not null default 'database', "role" varchar(255) not null default 'user', "deleted_at" timestamptz null, primary key ("sub"));`,
    );
    this.addSql(`comment on table "user" is 'Registered users';`);
    this.addSql(
      `comment on column "user"."sub" is 'Subject identifier as UUID';`,
    );
    this.addSql(
      `comment on column "user"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "user"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(`comment on column "user"."email" is 'User email address';`);
    this.addSql(
      `comment on column "user"."email_verified" is 'Whether the user''s email has been verified';`,
    );
    this.addSql(
      `comment on column "user"."password_hash" is 'Hashed password for local authentication';`,
    );
    this.addSql(
      `comment on column "user"."managed_by" is 'Data source: config (from YAML) or database (runtime created)';`,
    );
    this.addSql(
      `comment on column "user"."role" is 'User role: user or admin';`,
    );
    this.addSql(
      `comment on column "user"."deleted_at" is 'Timestamp when the user requested account deletion (soft delete)';`,
    );
    this.addSql(`create index "user_email_unique" on "user" ("email");`);
    this.addSql(`create index "user_deleted_at_idx" on "user" ("deleted_at");`);

    this.addSql(
      `create table "user_consent" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_sub" uuid not null, "client_id" uuid not null, "scopes" jsonb not null default '[]', "granted_at" timestamptz not null, "revoked_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "user_consent" is 'User consent decisions for OAuth clients';`,
    );
    this.addSql(
      `comment on column "user_consent"."id" is 'Primary key as UUID';`,
    );
    this.addSql(
      `comment on column "user_consent"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "user_consent"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "user_consent"."user_sub" is 'Reference to the user who granted consent';`,
    );
    this.addSql(
      `comment on column "user_consent"."client_id" is 'Reference to the OAuth client that received consent';`,
    );
    this.addSql(
      `comment on column "user_consent"."scopes" is 'List of scopes the user has consented to';`,
    );
    this.addSql(
      `comment on column "user_consent"."granted_at" is 'Timestamp when consent was first granted';`,
    );
    this.addSql(
      `comment on column "user_consent"."revoked_at" is 'Timestamp when consent was revoked (null if active)';`,
    );
    this.addSql(
      `create index "user_consent_user_sub_index" on "user_consent" ("user_sub");`,
    );
    this.addSql(
      `create index "user_consent_client_id_index" on "user_consent" ("client_id");`,
    );
    this.addSql(
      `alter table "user_consent" add constraint "user_consent_unique" unique ("user_sub", "client_id");`,
    );

    this.addSql(
      `create table "revoked_tokens" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "jti" varchar(255) not null, "token_type" text not null, "client_id" uuid not null, "user_sub" uuid not null, "expires_at" timestamptz not null, "revoked_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "revoked_tokens" is 'Revoked OAuth tokens for invalidation before expiry';`,
    );
    this.addSql(
      `comment on column "revoked_tokens"."id" is 'Primary key as UUID';`,
    );
    this.addSql(
      `comment on column "revoked_tokens"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "revoked_tokens"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "revoked_tokens"."jti" is 'JWT ID (jti claim) of the revoked token';`,
    );
    this.addSql(
      `comment on column "revoked_tokens"."token_type" is 'Type of the revoked token (access_token or refresh_token)';`,
    );
    this.addSql(
      `comment on column "revoked_tokens"."client_id" is 'Reference to the OAuth client that the token was issued to';`,
    );
    this.addSql(
      `comment on column "revoked_tokens"."user_sub" is 'Reference to the user (subject) that the token was issued for';`,
    );
    this.addSql(
      `comment on column "revoked_tokens"."expires_at" is 'Original expiration time of the token. Used for cleanup of expired entries.';`,
    );
    this.addSql(
      `comment on column "revoked_tokens"."revoked_at" is 'Timestamp when the token was revoked';`,
    );
    this.addSql(
      `alter table "revoked_tokens" add constraint "revoked_tokens_jti_unique" unique ("jti");`,
    );
    this.addSql(
      `create index "revoked_token_jti_idx" on "revoked_tokens" ("jti");`,
    );
    this.addSql(
      `create index "revoked_token_client_user_idx" on "revoked_tokens" ("client_id", "user_sub");`,
    );
    this.addSql(
      `create index "revoked_token_expires_at_idx" on "revoked_tokens" ("expires_at");`,
    );
    this.addSql(
      `alter table "revoked_tokens" add constraint "revoked_tokens_token_type_check" check ("token_type" in ('access_token', 'refresh_token'));`,
    );

    this.addSql(
      `create table "password_reset" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_sub" uuid not null, "token" varchar(255) not null, "expires_at" timestamptz not null, "used" boolean not null default false, "used_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "password_reset" is 'Password reset tokens for user password recovery';`,
    );
    this.addSql(
      `comment on column "password_reset"."id" is 'Primary key as UUID';`,
    );
    this.addSql(
      `comment on column "password_reset"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "password_reset"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "password_reset"."user_sub" is 'Reference to the user';`,
    );
    this.addSql(
      `comment on column "password_reset"."token" is 'Unique password reset token';`,
    );
    this.addSql(
      `comment on column "password_reset"."expires_at" is 'Token expiration timestamp';`,
    );
    this.addSql(
      `comment on column "password_reset"."used" is 'Whether the token has been used';`,
    );
    this.addSql(
      `comment on column "password_reset"."used_at" is 'Timestamp when the token was used';`,
    );
    this.addSql(
      `create index "password_reset_user_sub_idx" on "password_reset" ("user_sub");`,
    );
    this.addSql(
      `create index "password_reset_token_idx" on "password_reset" ("token");`,
    );

    this.addSql(
      `create table "oauth_code" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "code_hash" varchar(255) not null, "client_id" uuid not null, "user_sub" uuid not null, "redirect_uri" varchar(255) null, "scope" jsonb not null default '[]', "nonce" varchar(255) not null, "code_challenge" varchar(255) not null, "code_challenge_method" text not null default 'S256', "expired_at" timestamptz not null, "consumed_at" timestamptz null, "auth_time" int null, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "oauth_code" is 'Issued OAuth authorization codes';`,
    );
    this.addSql(
      `comment on column "oauth_code"."id" is 'Primary key as UUID';`,
    );
    this.addSql(
      `comment on column "oauth_code"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "oauth_code"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "oauth_code"."code_hash" is 'Hash of the issued authorization code';`,
    );
    this.addSql(
      `comment on column "oauth_code"."client_id" is 'Reference to the OAuth client that requested the code';`,
    );
    this.addSql(
      `comment on column "oauth_code"."user_sub" is 'Reference to the resource owner (user)';`,
    );
    this.addSql(
      `comment on column "oauth_code"."redirect_uri" is 'Redirect URI used during the authorization request';`,
    );
    this.addSql(
      `comment on column "oauth_code"."scope" is 'Scopes granted by the authorization code';`,
    );
    this.addSql(
      `comment on column "oauth_code"."nonce" is 'Nonce value associated with the authorization request';`,
    );
    this.addSql(
      `comment on column "oauth_code"."code_challenge" is 'PKCE code challenge value';`,
    );
    this.addSql(
      `comment on column "oauth_code"."code_challenge_method" is 'PKCE code challenge method';`,
    );
    this.addSql(
      `comment on column "oauth_code"."expired_at" is 'Absolute expiry timestamp for the code';`,
    );
    this.addSql(
      `comment on column "oauth_code"."consumed_at" is 'Timestamp when the code was redeemed';`,
    );
    this.addSql(
      `comment on column "oauth_code"."auth_time" is 'Time when the End-User authentication occurred (Unix timestamp). Used for auth_time claim in ID Token (OIDC Core 1.0 §2)';`,
    );
    this.addSql(
      `alter table "oauth_code" add constraint "oauth_code_code_hash_unique" unique ("code_hash");`,
    );
    this.addSql(
      `create index "auth_code_hash_idx" on "oauth_code" ("code_hash");`,
    );
    this.addSql(
      `create index "oauth_code_client_consumed_idx" on "oauth_code" ("client_id", "consumed_at");`,
    );
    this.addSql(
      `create index "oauth_code_expired_at_idx" on "oauth_code" ("expired_at");`,
    );
    this.addSql(
      `alter table "oauth_code" add constraint "oauth_code_code_challenge_method_check" check ("code_challenge_method" in ('S256', 'plain'));`,
    );

    this.addSql(
      `create table "email_verification" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_sub" uuid not null, "token" varchar(255) not null, "expires_at" timestamptz not null, "verified" boolean not null default false, "verified_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "email_verification" is 'Email verification tokens for user registration';`,
    );
    this.addSql(
      `comment on column "email_verification"."id" is 'Primary key as UUID';`,
    );
    this.addSql(
      `comment on column "email_verification"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "email_verification"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "email_verification"."user_sub" is 'Reference to the user';`,
    );
    this.addSql(
      `comment on column "email_verification"."token" is 'Unique verification token';`,
    );
    this.addSql(
      `comment on column "email_verification"."expires_at" is 'Token expiration timestamp';`,
    );
    this.addSql(
      `comment on column "email_verification"."verified" is 'Whether the token has been used';`,
    );
    this.addSql(
      `comment on column "email_verification"."verified_at" is 'Timestamp when the email was verified';`,
    );
    this.addSql(
      `create index "email_verification_user_sub_idx" on "email_verification" ("user_sub");`,
    );
    this.addSql(
      `create index "email_verification_token_idx" on "email_verification" ("token");`,
    );

    this.addSql(
      `create table "user_oauth" ("id" bigserial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_sub" uuid not null, "provider_name" varchar(255) not null, "provider_user_id" varchar(255) not null, "access_token" varchar(255) not null, "refresh_token" varchar(255) not null, "expires_at" timestamptz null);`,
    );
    this.addSql(
      `comment on table "user_oauth" is 'OAuth accounts linked to users';`,
    );
    this.addSql(
      `comment on column "user_oauth"."id" is 'Primary key as auto-incrementing bigint';`,
    );
    this.addSql(
      `comment on column "user_oauth"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "user_oauth"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "user_oauth"."user_sub" is 'Reference to the user';`,
    );
    this.addSql(
      `comment on column "user_oauth"."provider_name" is 'Name of the OAuth provider (e.g., google, facebook)';`,
    );
    this.addSql(
      `comment on column "user_oauth"."provider_user_id" is 'Unique user ID from the OAuth provider';`,
    );
    this.addSql(
      `comment on column "user_oauth"."access_token" is 'OAuth access token';`,
    );
    this.addSql(
      `comment on column "user_oauth"."refresh_token" is 'OAuth refresh token';`,
    );
    this.addSql(
      `comment on column "user_oauth"."expires_at" is 'Access token expiry timestamp';`,
    );
    this.addSql(
      `create index "user_oauth_user_sub_idx" on "user_oauth" ("user_sub");`,
    );
    this.addSql(
      `create index "user_oauth_user_provider_idx" on "user_oauth" ("user_sub", "provider_name");`,
    );
    this.addSql(
      `alter table "user_oauth" add constraint "user_oauth_provider_unique" unique ("provider_name", "provider_user_id");`,
    );

    this.addSql(
      `create table "user_passkey" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_sub" uuid not null, "credential_id" varchar(255) not null, "public_key" text not null, "counter" int not null default 0, "device_type" varchar(255) not null default 'singleDevice', "backed_up" boolean not null default false, "transports" jsonb null, "name" varchar(255) null, "aaguid" varchar(255) null, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "user_passkey" is 'User passkeys for WebAuthn authentication';`,
    );
    this.addSql(
      `comment on column "user_passkey"."id" is 'Primary key as UUID';`,
    );
    this.addSql(
      `comment on column "user_passkey"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "user_passkey"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "user_passkey"."user_sub" is 'Reference to the user';`,
    );
    this.addSql(
      `comment on column "user_passkey"."credential_id" is 'WebAuthn credential ID (base64url encoded)';`,
    );
    this.addSql(
      `comment on column "user_passkey"."public_key" is 'Public key (base64url encoded)';`,
    );
    this.addSql(
      `comment on column "user_passkey"."counter" is 'Signature counter for replay attack prevention';`,
    );
    this.addSql(
      `comment on column "user_passkey"."device_type" is 'Credential device type: singleDevice or multiDevice';`,
    );
    this.addSql(
      `comment on column "user_passkey"."backed_up" is 'Whether the credential is backed up (synced passkey)';`,
    );
    this.addSql(
      `comment on column "user_passkey"."transports" is 'Supported authenticator transports (usb, ble, nfc, internal, etc)';`,
    );
    this.addSql(
      `comment on column "user_passkey"."name" is 'User-defined name for the passkey';`,
    );
    this.addSql(
      `comment on column "user_passkey"."aaguid" is 'Authenticator Attestation GUID for device identification';`,
    );
    this.addSql(
      `create index "user_passkey_user_sub_idx" on "user_passkey" ("user_sub");`,
    );
    this.addSql(
      `create index "user_passkey_credential_id_unique" on "user_passkey" ("credential_id");`,
    );

    this.addSql(
      `create table "user_terms_consent" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_sub" uuid not null, "terms_id" varchar(255) not null, "terms_version" varchar(255) not null, "agreed" boolean not null, "consent_type" varchar(255) not null, "agreed_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "user_terms_consent" is 'User consent records for terms of service';`,
    );
    this.addSql(
      `comment on column "user_terms_consent"."id" is 'Primary key as UUID';`,
    );
    this.addSql(
      `comment on column "user_terms_consent"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "user_terms_consent"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "user_terms_consent"."user_sub" is 'Reference to the user who gave consent';`,
    );
    this.addSql(
      `comment on column "user_terms_consent"."terms_id" is 'Reference to the terms';`,
    );
    this.addSql(
      `comment on column "user_terms_consent"."terms_version" is 'Version of the term that was agreed to';`,
    );
    this.addSql(
      `comment on column "user_terms_consent"."agreed" is 'Whether the user agreed to the term';`,
    );
    this.addSql(
      `comment on column "user_terms_consent"."consent_type" is 'How consent was obtained: explicit (checkbox) or implicit';`,
    );
    this.addSql(
      `comment on column "user_terms_consent"."agreed_at" is 'Timestamp when consent was given';`,
    );
    this.addSql(
      `create index "user_terms_consent_user_sub_index" on "user_terms_consent" ("user_sub");`,
    );
    this.addSql(
      `create index "user_terms_consent_terms_id_index" on "user_terms_consent" ("terms_id");`,
    );
    this.addSql(
      `create index "user_terms_consent_user_terms_index" on "user_terms_consent" ("user_sub", "terms_id");`,
    );

    this.addSql(
      `create table "user_totp" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_sub" uuid not null, "secret" varchar(255) not null, "verified" boolean not null default false, "recovery_confirmed" boolean not null default false, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "user_totp" is 'User TOTP secrets for two-factor authentication';`,
    );
    this.addSql(`comment on column "user_totp"."id" is 'Primary key as UUID';`);
    this.addSql(
      `comment on column "user_totp"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "user_totp"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "user_totp"."user_sub" is 'Reference to the user';`,
    );
    this.addSql(
      `comment on column "user_totp"."secret" is 'TOTP secret key (base32 encoded)';`,
    );
    this.addSql(
      `comment on column "user_totp"."verified" is 'Whether the TOTP setup has been verified';`,
    );
    this.addSql(
      `comment on column "user_totp"."recovery_confirmed" is 'Whether the user has confirmed saving recovery codes';`,
    );
    this.addSql(
      `alter table "user_totp" add constraint "user_totp_user_unique" unique ("user_sub");`,
    );

    this.addSql(
      `create table "user_totp_recovery_code" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_sub" uuid not null, "code_hash" varchar(255) not null, "used" boolean not null default false, "used_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "user_totp_recovery_code" is 'One-time recovery codes for TOTP two-factor authentication';`,
    );
    this.addSql(
      `comment on column "user_totp_recovery_code"."id" is 'Primary key as UUID';`,
    );
    this.addSql(
      `comment on column "user_totp_recovery_code"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "user_totp_recovery_code"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "user_totp_recovery_code"."user_sub" is 'Reference to the user';`,
    );
    this.addSql(
      `comment on column "user_totp_recovery_code"."code_hash" is 'Versioned recovery code hash';`,
    );
    this.addSql(
      `comment on column "user_totp_recovery_code"."used" is 'Whether this recovery code has been used';`,
    );
    this.addSql(
      `comment on column "user_totp_recovery_code"."used_at" is 'Timestamp when this recovery code was used';`,
    );
    this.addSql(
      `create index "user_totp_recovery_code_user_sub_idx" on "user_totp_recovery_code" ("user_sub");`,
    );

    this.addSql(
      `alter table "terms_content" add constraint "terms_content_terms_id_foreign" foreign key ("terms_id") references "terms" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "user_consent" add constraint "user_consent_user_sub_foreign" foreign key ("user_sub") references "user" ("sub");`,
    );
    this.addSql(
      `alter table "user_consent" add constraint "user_consent_client_id_foreign" foreign key ("client_id") references "oauth_client" ("id");`,
    );

    this.addSql(
      `alter table "revoked_tokens" add constraint "revoked_tokens_client_id_foreign" foreign key ("client_id") references "oauth_client" ("id");`,
    );
    this.addSql(
      `alter table "revoked_tokens" add constraint "revoked_tokens_user_sub_foreign" foreign key ("user_sub") references "user" ("sub");`,
    );

    this.addSql(
      `alter table "password_reset" add constraint "password_reset_user_sub_foreign" foreign key ("user_sub") references "user" ("sub");`,
    );

    this.addSql(
      `alter table "oauth_code" add constraint "oauth_code_client_id_foreign" foreign key ("client_id") references "oauth_client" ("id");`,
    );
    this.addSql(
      `alter table "oauth_code" add constraint "oauth_code_user_sub_foreign" foreign key ("user_sub") references "user" ("sub");`,
    );

    this.addSql(
      `alter table "email_verification" add constraint "email_verification_user_sub_foreign" foreign key ("user_sub") references "user" ("sub");`,
    );

    this.addSql(
      `alter table "user_oauth" add constraint "user_oauth_user_sub_foreign" foreign key ("user_sub") references "user" ("sub");`,
    );

    this.addSql(
      `alter table "user_passkey" add constraint "user_passkey_user_sub_foreign" foreign key ("user_sub") references "user" ("sub") on delete cascade;`,
    );

    this.addSql(
      `alter table "user_terms_consent" add constraint "user_terms_consent_user_sub_foreign" foreign key ("user_sub") references "user" ("sub") on delete cascade;`,
    );
    this.addSql(
      `alter table "user_terms_consent" add constraint "user_terms_consent_terms_id_foreign" foreign key ("terms_id") references "terms" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "user_totp" add constraint "user_totp_user_sub_foreign" foreign key ("user_sub") references "user" ("sub") on delete cascade;`,
    );

    this.addSql(
      `alter table "user_totp_recovery_code" add constraint "user_totp_recovery_code_user_sub_foreign" foreign key ("user_sub") references "user" ("sub") on delete cascade;`,
    );
  }
}

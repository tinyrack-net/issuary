import type { Options } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from '@mikro-orm/seeder';
import { defineConfig, SqliteDriver } from '@mikro-orm/sqlite';
import { EmailVerificationEntitySchema } from '../entities/email-verification.entity.js';
import { JwtKeyEntitySchema } from '../entities/jwt-key.entity.js';
import { OAuthClientEntitySchema } from '../entities/oauth-client.entity.js';
import { OAuthCodeEntitySchema } from '../entities/oauth-code.entity.js';
import { PasswordResetEntitySchema } from '../entities/password-reset.entity.js';
import { PendingOAuthRegistrationEntitySchema } from '../entities/pending-oauth-registration.entity.js';
import { RevokedTokenEntitySchema } from '../entities/revoked-token.entity.js';
import { TermsEntitySchema } from '../entities/terms.entity.js';
import { TermsContentEntitySchema } from '../entities/terms-content.entity.js';
import { UserEntitySchema } from '../entities/user.entity.js';
import { UserConsentEntitySchema } from '../entities/user-consent.entity.js';
import { UserOAuthEntitySchema } from '../entities/user-oauth.entity.js';
import { UserPasskeyEntitySchema } from '../entities/user-passkey.entity.js';
import { UserTermsConsentEntitySchema } from '../entities/user-terms-consent.entity.js';
import { UserTotpEntitySchema } from '../entities/user-totp.entity.js';
import { UserTotpRecoveryCodeEntitySchema } from '../entities/user-totp-recovery-code.entity.js';
import type { AppConfigDatabaseSqlite } from '../lib/config/schema.js';
import compiledFunctions from './compiled-functions.js';

export const mikroormSqliteConfig = (
  database: AppConfigDatabaseSqlite,
): Options => {
  return defineConfig({
    driver: SqliteDriver,
    dbName: database.test ? ':memory:' : database.path,
    compiledFunctions: compiledFunctions,
    entities: [
      UserEntitySchema,
      OAuthClientEntitySchema,
      OAuthCodeEntitySchema,
      JwtKeyEntitySchema,
      EmailVerificationEntitySchema,
      PasswordResetEntitySchema,
      PendingOAuthRegistrationEntitySchema,
      RevokedTokenEntitySchema,
      TermsEntitySchema,
      TermsContentEntitySchema,
      UserConsentEntitySchema,
      UserOAuthEntitySchema,
      UserPasskeyEntitySchema,
      UserTermsConsentEntitySchema,
      UserTotpRecoveryCodeEntitySchema,
      UserTotpEntitySchema,
    ],
    extensions: [SeedManager, Migrator],
    debug: false,
  });
};

import type { Options } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { SeedManager } from '@mikro-orm/seeder';
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
import compiledFunctions from './compiled-functions.js';

export const mikroormPostgresConfig = (database: {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
}): Options => {
  return defineConfig({
    compiledFunctions: compiledFunctions,
    driver: PostgreSqlDriver,
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
    host: database.host,
    port: database.port,
    dbName: database.name,
    user: database.user,
    password: database.password,
    extensions: [SeedManager, Migrator],
    driverOptions: {
      connection: {
        ssl: true,
      },
    },
    debug: false,
  });
};

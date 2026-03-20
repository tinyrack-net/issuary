import { defineConfig, type MikroORM } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from '@mikro-orm/seeder';
import { NodeSqliteDialect, SqliteDriver } from '@mikro-orm/sql';
import { EmailVerificationEntitySchema } from '#backend/entities/email-verification.entity.js';
import { JwtKeyEntitySchema } from '#backend/entities/jwt-key.entity.js';
import { OAuthClientEntitySchema } from '#backend/entities/oauth-client.entity.js';
import { OAuthCodeEntitySchema } from '#backend/entities/oauth-code.entity.js';
import { PasswordResetEntitySchema } from '#backend/entities/password-reset.entity.js';
import { PendingOAuthRegistrationEntitySchema } from '#backend/entities/pending-oauth-registration.entity.js';
import { RevokedTokenEntitySchema } from '#backend/entities/revoked-token.entity.js';
import { TermsEntitySchema } from '#backend/entities/terms.entity.js';
import { TermsContentEntitySchema } from '#backend/entities/terms-content.entity.js';
import { UserEntitySchema } from '#backend/entities/user.entity.js';
import { UserConsentEntitySchema } from '#backend/entities/user-consent.entity.js';
import { UserOAuthEntitySchema } from '#backend/entities/user-oauth.entity.js';
import { UserPasskeyEntitySchema } from '#backend/entities/user-passkey.entity.js';
import { UserTermsConsentEntitySchema } from '#backend/entities/user-terms-consent.entity.js';
import { UserTotpEntitySchema } from '#backend/entities/user-totp.entity.js';
import { UserTotpRecoveryCodeEntitySchema } from '#backend/entities/user-totp-recovery-code.entity.js';
import type { DatabaseConfig } from '#backend/lib/config/index.js';
import compiledFunctions from './compiled-functions.js';

export function sqlite(database: {
  path: string;
  test: boolean;
}): DatabaseConfig {
  const dbName = database.test ? ':memory:' : database.path;

  return {
    getMikroOrmOptions: async () => {
      return defineConfig({
        driver: SqliteDriver,
        dbName: dbName,
        driverOptions: new NodeSqliteDialect(dbName),
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
    },
    initialize: async (orm: MikroORM) => {
      if (database.test) {
        await orm.schema.refresh();
      } else {
        await orm.migrator.up();
      }
    },
  };
}

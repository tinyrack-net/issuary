import { defineConfig, type MikroORM } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from '@mikro-orm/seeder';
import { NodeSqliteDialect, SqliteDriver } from '@mikro-orm/sql';
import { EmailVerificationEntitySchema } from '../../../entities/email-verification.entity.ts';
import { JwtKeyEntitySchema } from '../../../entities/jwt-key.entity.ts';
import { OAuthClientEntitySchema } from '../../../entities/oauth-client.entity.ts';
import { OAuthCodeEntitySchema } from '../../../entities/oauth-code.entity.ts';
import { PasswordResetEntitySchema } from '../../../entities/password-reset.entity.ts';
import { PendingOAuthRegistrationEntitySchema } from '../../../entities/pending-oauth-registration.entity.ts';
import { RevokedTokenEntitySchema } from '../../../entities/revoked-token.entity.ts';
import { TermsEntitySchema } from '../../../entities/terms.entity.ts';
import { TermsContentEntitySchema } from '../../../entities/terms-content.entity.ts';
import { UserEntitySchema } from '../../../entities/user.entity.ts';
import { UserConsentEntitySchema } from '../../../entities/user-consent.entity.ts';
import { UserOAuthEntitySchema } from '../../../entities/user-oauth.entity.ts';
import { UserPasskeyEntitySchema } from '../../../entities/user-passkey.entity.ts';
import { UserTermsConsentEntitySchema } from '../../../entities/user-terms-consent.entity.ts';
import { UserTotpEntitySchema } from '../../../entities/user-totp.entity.ts';
import { UserTotpRecoveryCodeEntitySchema } from '../../../entities/user-totp-recovery-code.entity.ts';
import type { DatabaseConfig } from '../../../lib/config/index.ts';
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

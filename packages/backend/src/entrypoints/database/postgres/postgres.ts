import { defineConfig, type MikroORM } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { SeedManager } from '@mikro-orm/seeder';
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

export function postgres(database: {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}): DatabaseConfig {
  return {
    getMikroOrmOptions: async () => {
      return defineConfig({
        driver: PostgreSqlDriver,
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
    },
    initialize: async (orm: MikroORM) => {
      await orm.migrator.up();
    },
  };
}

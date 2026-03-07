import { defineConfig, type MikroORM } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { SeedManager } from '@mikro-orm/seeder';
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
import type { DatabaseConfigRuntime } from '#backend/lib/config/index.js';

export function postgres(database: {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}): DatabaseConfigRuntime {
  return {
    getMikroOrmOptions: async () => {
      return defineConfig({
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
    },
    initialize: async (orm: MikroORM) => {
      await orm.migrator.up();
    },
  };
}

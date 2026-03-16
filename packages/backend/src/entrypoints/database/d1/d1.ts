/// <reference types="@cloudflare/workers-types" />
import { defineConfig, type MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { D1Dialect } from 'kysely-d1';
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
// import compiledFunctions from './compiled-functions.js';

export function d1(database: { database: D1Database }): DatabaseConfig {
  return {
    getMikroOrmOptions: async () => {
      return defineConfig({
        driver: SqliteDriver,
        // compiledFunctions: compiledFunctions,
        dbName: 'd1',
        driverOptions: new D1Dialect({ database: database.database }),
        implicitTransactions: false,
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
        debug: false,
      });
    },
    initialize: async (_orm: MikroORM) => {
      const schemaSQL = _orm.schema
        .getCreateSchemaSQL({ wrap: false })
        .then((sql) =>
          sql
            .split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        );
      for (const statement of await schemaSQL) {
        try {
          await database.database.exec(statement);
        } catch {
          // ignore "table already exists" errors
        }
      }
    },
  };
}

/// <reference types="@cloudflare/workers-types" />
import { defineConfig, type MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sql';
import { D1Dialect } from 'kysely-d1';
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

export function d1(database: { database: D1Database }): DatabaseConfig {
  return {
    getMikroOrmOptions: async () => {
      return defineConfig({
        driver: SqliteDriver,
        compiledFunctions: compiledFunctions,
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

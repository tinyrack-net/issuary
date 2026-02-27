import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Options } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { SeedManager } from '@mikro-orm/seeder';
import type { ResolvedAppConfig } from '#backend/lib/config/index.js';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const mikroormPostgresConfig = (config: ResolvedAppConfig): Options => {
  if (config.database.type !== 'postgres') {
    throw new Error('Database type is not postgres');
  }
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
    migrations: {
      path: path.join(__dirname, '../migrations/postgres'),
      pathTs: path.join(__dirname, '../migrations/postgres'),
      glob: '!(*.d).{ts,js}',
    },
    host: config.database.host,
    port: config.database.port,
    dbName: config.database.name,
    user: config.database.user,
    password: config.database.password,
    extensions: [SeedManager, Migrator],
    driverOptions: {
      connection: {
        ssl: true,
      },
    },
    debug: true,
  });
};

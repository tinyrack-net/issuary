import z from 'zod';
import { postgres, sqlite } from '#backend/database.js';
import {
  apple,
  genericOAuth,
  github,
  google,
  type ResolvedIdentityProvider,
} from '#backend/identity-provider.js';
import { smtp } from '#backend/mail.js';
import { ConfigValidationError } from '../format-zod-error.js';
import {
  type AppConfig,
  AppConfigSchema,
  type AppConfigSmtp,
  type ResolvedAppConfig,
} from './schema.js';

/**
 * Parse input through AppConfigSchema, converting ZodError into a
 * human-readable ConfigValidationError.
 */
export function parseConfig(input: unknown): AppConfig {
  try {
    return AppConfigSchema.parse(input);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new ConfigValidationError(err.issues);
    }
    throw err;
  }
}

/**
 * Resolve SMTP configuration.
 * If `test: true`, creates a test account via nodemailer.
 * Otherwise, returns the provided SMTP config as-is.
 */
const resolveSmtpConfig = async (
  smtp: AppConfig['smtp'],
): Promise<AppConfigSmtp | undefined> => {
  if (!smtp) {
    return undefined;
  }
  if (smtp.test) {
    const { default: nodemailer } = await import('nodemailer');
    const testAccount = await nodemailer.createTestAccount();
    return {
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      user: testAccount.user,
      password: testAccount.pass,
      from: testAccount.user,
      test: true,
    };
  }
  return smtp;
};

const composeDatabaseConfig = (
  database: AppConfig['database'],
): ResolvedAppConfig['database'] => {
  switch (database.type) {
    case 'postgres':
      return postgres(database);
    case 'sqlite':
      return sqlite(database);
  }
};

const composeIdentityProvider = (
  config: AppConfig['identity_providers'][number],
): ResolvedIdentityProvider => {
  switch (config.type) {
    case 'github': {
      const { type: _, ...rest } = config;
      return github(rest);
    }
    case 'google': {
      const { type: _, ...rest } = config;
      return google(rest);
    }
    case 'apple': {
      const { type: _, ...rest } = config;
      return apple(rest);
    }
    case 'generic_oauth': {
      const { type: _, ...rest } = config;
      return genericOAuth(rest);
    }
  }
};

/**
 * Transform raw backend config input to ResolvedAppConfig.
 * This parses the input through the backend schema (applying defaults),
 * resolves test SMTP accounts, and returns the fully resolved config.
 *
 * @param input - The configuration input (with optional fields)
 * @returns The fully resolved configuration with all defaults applied
 */
export async function resolveConfig(
  input: unknown,
): Promise<ResolvedAppConfig> {
  // Parse through AppConfigSchema to apply all defaults
  const parsed = parseConfig(input);

  // Resolve SMTP config (handle test: true case)
  const smtpConfig = await resolveSmtpConfig(parsed.smtp);

  const {
    smtp: _smtp,
    database: _database,
    identity_providers: _idp,
    ...rest
  } = parsed;
  const databaseConfig = composeDatabaseConfig(parsed.database);
  const identityProvidersConfig = parsed.identity_providers.map(
    composeIdentityProvider,
  );

  return {
    ...rest,
    database: databaseConfig,
    identity_providers: identityProvidersConfig,
    ...(smtpConfig ? { smtp: smtp(smtpConfig) } : {}),
  };
}

import nodemailer from 'nodemailer';
import z from 'zod';
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

  return {
    ...parsed,
    smtp: smtpConfig,
  };
}

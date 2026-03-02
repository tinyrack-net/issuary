import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import z from 'zod';
import { ConfigValidationError } from '../format-zod-error.js';
import {
  type AppConfig,
  type AppConfigInput,
  AppConfigSchema,
  type AppConfigSmtp,
  type ResolvedAppConfig,
  type ResolvedAppConfigFrontend,
} from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
 * Default path for the built-in public/ directory.
 * Resolved relative to this file: lib/config/ → ../../public
 * (works for both src/ and dist/ layouts).
 */
export const DEFAULT_STATIC_PATH = path.resolve(__dirname, '../../public');

/**
 * Default upstream URL for proxy mode.
 */
export const DEFAULT_PROXY_UPSTREAM = 'http://localhost:8081';

/**
 * Resolve the frontend configuration, filling in defaults
 * for `path` based on the chosen mode.
 */
function resolveFrontendConfig(
  frontend: AppConfig['app']['frontend'],
): ResolvedAppConfigFrontend {
  const { enabled, mode } = frontend;
  let resolvedPath: string;

  if (frontend.path !== undefined) {
    resolvedPath = frontend.path;
  } else if (mode === 'proxy') {
    resolvedPath = DEFAULT_PROXY_UPSTREAM;
  } else {
    resolvedPath = DEFAULT_STATIC_PATH;
  }

  return { enabled, mode, path: resolvedPath };
}

/**
 * Transform AppConfigInput to ResolvedAppConfig.
 * This parses the input through the schema (applying defaults),
 * resolves test SMTP accounts, and returns the fully resolved config.
 *
 * @param input - The configuration input (with optional fields)
 * @returns The fully resolved configuration with all defaults applied
 */
export async function resolveConfig(
  input: AppConfigInput,
): Promise<ResolvedAppConfig> {
  // Parse through AppConfigSchema to apply all defaults
  const parsed = parseConfig(input);

  // Resolve SMTP config (handle test: true case)
  const smtpConfig = await resolveSmtpConfig(parsed.smtp);

  // Resolve frontend config (fill in path defaults)
  const resolvedFrontend = resolveFrontendConfig(parsed.app.frontend);

  return {
    ...parsed,
    app: {
      ...parsed.app,
      frontend: resolvedFrontend,
    },
    smtp: smtpConfig,
  };
}

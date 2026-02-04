import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import YAML from 'yaml';
import { env } from '../env.js';
import { resolveEnvVariables } from '../interpolate-env.js';
import {
  type AppConfig,
  type AppConfigInput,
  AppConfigSchema,
  type AppConfigSmtp,
  type ResolvedAppConfig,
} from './schema.js';

const DEFAULT_CONFIG_PATH = '/opt/config.yaml';

/**
 * Default configuration with environment variable references.
 * Always used as the base layer — user config.yaml is deep-merged
 * on top, then env vars are resolved last.
 *
 * This ensures environment variables work regardless of whether
 * a config file exists. Only `COOKIE_SECRET` is required.
 * Arrays and complex nested objects are omitted; they use Zod defaults.
 */
const DEFAULT_CONFIG = {
  app: {
    name: '${APP_NAME:-Tinyrack Auth}',
    host: '${APP_HOST:-http://localhost:8080}',
    port: '${PORT:-8080}',
    cookie_secret: '${COOKIE_SECRET}',
    jwt_access_token_ttl: '${JWT_ACCESS_TOKEN_TTL:-3600}',
    jwt_refresh_token_ttl: '${JWT_REFRESH_TOKEN_TTL:-2592000}',
    jwt_key_rotation_enabled: '${JWT_KEY_ROTATION_ENABLED:-true}',
    jwt_key_rotation_days: '${JWT_KEY_ROTATION_DAYS:-30}',
    jwt_key_overlap_days: '${JWT_KEY_OVERLAP_DAYS:-7}',
    default_language: '${DEFAULT_LANGUAGE:-auto}',
    fallback_language: '${FALLBACK_LANGUAGE:-en}',
    light_theme: '${LIGHT_THEME:-light}',
    dark_theme: '${DARK_THEME:-dark}',
    theme_mode: '${THEME_MODE:-system}',
    trust_proxy: '${TRUST_PROXY:-false}',
    account_deletion: '${ACCOUNT_DELETION:-false}',
  },
  database: {
    type: '${DB_TYPE:-sqlite}',
    path: '${DB_PATH:-/opt/tinyauth/database.db}',
  },
  scheduler: {
    enabled: '${SCHEDULER_ENABLED:-true}',
    cron: '${SCHEDULER_CRON:-0 2 * * *}',
  },
};

const resolveAbsolutePath = (configPath: string): string => {
  if (path.isAbsolute(configPath)) {
    return configPath;
  }
  return path.resolve(process.cwd(), configPath);
};

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
  const parsed = AppConfigSchema.parse(input);

  // Resolve SMTP config (handle test: true case)
  const smtpConfig = await resolveSmtpConfig(parsed.smtp);

  return {
    ...parsed,
    smtp: smtpConfig,
  };
}

const loadConfigFromPath = (configPath: string): AppConfig => {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found at "${configPath}"`);
  }
  const file = readFileSync(configPath, 'utf8');
  const rawConfig = YAML.parse(file);
  const merged = deepMerge(DEFAULT_CONFIG, rawConfig);
  const resolvedConfig = resolveEnvVariables(merged);
  return AppConfigSchema.parse(resolvedConfig);
};

/**
 * Deep merge utility for config objects.
 * Arrays are replaced, not merged.
 * Exported for use by callers who need to merge configs (e.g., tests).
 */
export function deepMerge<T extends object>(
  target: T,
  source: DeepPartial<T>,
): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as object,
        sourceValue as object,
      ) as T[Extract<keyof T, string>];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * DeepPartial type for nested partial objects.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Load configuration from file or environment variables.
 *
 * Resolution order:
 * 1. Explicit `configPath` option (CLI --config-path) — error if missing
 * 2. `CONFIG_PATH` environment variable — error if missing
 * 3. Default path `/opt/config.yaml` — used if exists
 * 4. Fall back to `DEFAULT_CONFIG` with env var interpolation
 *
 * In the fallback case, only `COOKIE_SECRET` env var is required.
 * All other fields have sensible defaults.
 *
 * @param options - Optional configuration options
 * @param options.configPath - Custom config file path
 */
export function loadConfig(options?: {
  configPath?: string | undefined;
}): AppConfig {
  // 1. Explicit path provided by caller (e.g., CLI --config-path)
  if (options?.configPath) {
    const configPath = resolveAbsolutePath(options.configPath);
    console.info(`Loading config from: ${configPath}`);
    return loadConfigFromPath(configPath);
  }

  // 2. CONFIG_PATH env var is set — error if file missing
  if (env.CONFIG_PATH) {
    const configPath = resolveAbsolutePath(env.CONFIG_PATH);
    console.info(`Loading config from: ${configPath}`);
    return loadConfigFromPath(configPath);
  }

  // 3. Default path exists — use it
  if (existsSync(DEFAULT_CONFIG_PATH)) {
    console.info(`Loading config from: ${DEFAULT_CONFIG_PATH}`);
    return loadConfigFromPath(DEFAULT_CONFIG_PATH);
  }

  // 4. Fall back to environment variables with defaults
  console.info(
    'No config file found, using environment variables with defaults',
  );
  const resolved = resolveEnvVariables(DEFAULT_CONFIG);
  return AppConfigSchema.parse(resolved);
}

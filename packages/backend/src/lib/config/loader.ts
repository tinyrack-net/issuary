import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import YAML from 'yaml';
import { env } from '../env.js';
import {
  type AppConfig,
  type AppConfigInput,
  AppConfigSchema,
  type AppConfigSmtp,
  type ResolvedAppConfig,
} from './schemas/root.js';

const DEFAULT_CONFIG_PATH = '/opt/config.yaml';

const resolveConfigPath = () => {
  const configPath = env.CONFIG_PATH || DEFAULT_CONFIG_PATH;
  if (path.isAbsolute(configPath)) {
    return configPath;
  } else {
    return path.resolve(process.cwd(), configPath);
  }
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
  const rawConfig = YAML.parse(file, {
    customTags: [
      {
        tag: '!env',
        resolve: (str: string) => process.env[str],
      },
    ],
  });
  return AppConfigSchema.parse(rawConfig);
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
 * Load configuration from file.
 * Returns AppConfig which can be passed to createServer().
 * The caller is responsible for any config merging or overrides.
 *
 * @param options - Optional configuration options
 * @param options.configPath - Custom config file path (defaults to resolved path based on APP_ENV)
 */
export function loadConfig(options?: {
  configPath?: string | undefined;
}): AppConfig {
  const configPath = options?.configPath ?? resolveConfigPath();
  console.info(`Loading config from: ${configPath}`);
  return loadConfigFromPath(configPath);
}

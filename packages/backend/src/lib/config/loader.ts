import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import YAML from 'yaml';
import { env } from '../env.js';
import {
  type ExternalAppConfig,
  ExternalConfigSchema,
  type InternalAppConfig,
  InternalConfigSchema,
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
  smtp: ExternalAppConfig['smtp'],
): Promise<InternalAppConfig['smtp']> => {
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
 * Transform ExternalAppConfig to InternalAppConfig.
 * This resolves test SMTP accounts and applies all defaults.
 *
 * @param external - The external configuration (from config file or programmatic input)
 * @returns The fully resolved internal configuration with all defaults applied
 */
export async function resolveConfig(
  external: ExternalAppConfig,
): Promise<InternalAppConfig> {
  const smtpConfig = await resolveSmtpConfig(external.smtp);
  return InternalConfigSchema.parse({
    ...external,
    smtp: smtpConfig,
  });
}

const loadConfigFromPath = (configPath: string): ExternalAppConfig => {
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
  return ExternalConfigSchema.parse(rawConfig);
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
 * Returns ExternalAppConfig which can be passed to createServer().
 * The caller is responsible for any config merging or overrides.
 *
 * @param options - Optional configuration options
 * @param options.configPath - Custom config file path (defaults to resolved path based on APP_ENV)
 */
export function loadConfig(options?: {
  configPath?: string | undefined;
}): ExternalAppConfig {
  const configPath = options?.configPath ?? resolveConfigPath();
  console.info(`Loading config from: ${configPath}`);
  return loadConfigFromPath(configPath);
}

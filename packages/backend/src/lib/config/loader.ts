import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import YAML from 'yaml';
import { env } from '../env.js';
import {
  ConfigSchema,
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

const loadConfigFromPath = async (
  configPath: string,
): Promise<InternalAppConfig> => {
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
  const parsed = ConfigSchema.parse(rawConfig);

  const smtpConfig = await (async () => {
    if (!parsed.smtp) {
      return undefined;
    }
    if (parsed.smtp.test) {
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
    } else {
      return parsed.smtp;
    }
  })();

  return InternalConfigSchema.parse({
    ...parsed,
    smtp: smtpConfig,
  });
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
 * The caller is responsible for any config merging or overrides.
 *
 * @param options - Optional configuration options
 * @param options.configPath - Custom config file path (defaults to resolved path based on APP_ENV)
 */
export async function loadConfig(options?: {
  configPath?: string | undefined;
}): Promise<InternalAppConfig> {
  const configPath = options?.configPath ?? resolveConfigPath();
  console.info(`Loading config from: ${configPath}`);
  return loadConfigFromPath(configPath);
}

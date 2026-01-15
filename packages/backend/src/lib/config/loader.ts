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
  const configPath =
    env.APP_ENV === 'test'
      ? './config.test.yaml'
      : env.CONFIG_PATH || DEFAULT_CONFIG_PATH;
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
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
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
 * Load configuration from file with optional overrides.
 * @param options - Optional configuration options
 * @param options.configPath - Custom config file path (defaults to resolved path based on APP_ENV)
 * @param options.baseConfig - Base config object to use instead of loading from file (useful for testing)
 * @param options.overrides - Partial config to override loaded values (useful for testing)
 */
export async function loadConfig(options?: {
  configPath?: string;
  baseConfig?: InternalAppConfig;
  overrides?: DeepPartial<InternalAppConfig>;
}): Promise<InternalAppConfig> {
  let config: InternalAppConfig;

  if (options?.baseConfig) {
    // Use provided base config instead of loading from file
    console.info('Using provided base config');
    config = options.baseConfig;
  } else {
    const configPath = options?.configPath ?? resolveConfigPath();
    console.info(`Loading config from: ${configPath}`);
    config = await loadConfigFromPath(configPath);
  }

  if (options?.overrides) {
    return deepMerge(config, options.overrides as Partial<InternalAppConfig>);
  }

  return config;
}

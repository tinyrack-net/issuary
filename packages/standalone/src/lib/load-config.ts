import * as fs from 'node:fs';
import { ConfigValidationError, resolveConfig } from '@tinyauth/backend/config';
import type { Logger } from '@tinyauth/backend/logger';
import YAML from 'yaml';
import z from 'zod';
import {
  type ResolvedStandaloneConfig,
  type ResolvedStandaloneFrontendConfig,
  type StandaloneConfig,
  type StandaloneConfigInput,
  StandaloneConfigSchema,
  type StandaloneFrontendConfig,
} from '#standalone/lib/config/schema.js';
import { resolveEnvVariables } from './interpolate-env.js';
import { resolveAbsolutePath } from './resolve-path.js';

export const DEFAULT_FRONTEND_PROXY_UPSTREAM = 'http://localhost:8081';
export const DEFAULT_FRONTEND_STATIC_PATH = '/opt/tinyauth/frontend';

function applyFrontendPathDefaults(config: StandaloneConfig): StandaloneConfig {
  const { frontend } = config.app;
  if (!frontend.enabled || frontend.path !== undefined) {
    return config;
  }

  return {
    ...config,
    app: {
      ...config.app,
      frontend: {
        ...frontend,
        path:
          frontend.mode === 'proxy'
            ? DEFAULT_FRONTEND_PROXY_UPSTREAM
            : DEFAULT_FRONTEND_STATIC_PATH,
      },
    },
  };
}

function resolveStandaloneFrontendConfig(
  frontend: StandaloneFrontendConfig,
): ResolvedStandaloneFrontendConfig {
  if (!frontend.enabled) {
    return {
      enabled: false,
      mode: frontend.mode,
      path: frontend.path ?? '',
    };
  }

  return {
    enabled: frontend.enabled,
    mode: frontend.mode,
    path:
      frontend.path ??
      (frontend.mode === 'proxy'
        ? DEFAULT_FRONTEND_PROXY_UPSTREAM
        : DEFAULT_FRONTEND_STATIC_PATH),
  };
}

function parseStandaloneConfig(input: unknown): StandaloneConfig {
  try {
    const config = StandaloneConfigSchema.parse(input);
    return applyFrontendPathDefaults(config);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new ConfigValidationError(err.issues);
    }
    throw err;
  }
}

const loadConfigFromPath = (configPath: string): StandaloneConfig => {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found at "${configPath}"`);
  }
  const file = fs.readFileSync(configPath, 'utf8');
  const rawConfig = YAML.parse(file);
  const resolvedConfig = resolveEnvVariables(rawConfig);
  return parseStandaloneConfig(resolvedConfig);
};

/**
 * Load configuration from a YAML config file.
 *
 * @param options - Configuration options
 * @param options.configPath - Path to the config file (required)
 * @param options.logger - Logger instance for config loading messages
 */
export function loadConfig(options: {
  configPath: string;
  logger?: Logger | undefined;
}): StandaloneConfig {
  const configPath = resolveAbsolutePath(options.configPath);
  options.logger?.info({ configPath }, 'Loading config from file');
  return loadConfigFromPath(configPath);
}

export async function resolveStandaloneConfig(
  input: StandaloneConfigInput | StandaloneConfig,
): Promise<ResolvedStandaloneConfig> {
  const parsed = parseStandaloneConfig(input);
  const backendConfig = await resolveConfig(input);
  return {
    ...backendConfig,
    app: {
      ...backendConfig.app,
      frontend: resolveStandaloneFrontendConfig(parsed.app.frontend),
      html_variables: parsed.app.html_variables,
    },
  };
}

export async function loadResolvedConfig(options: {
  configPath: string;
  logger?: Logger | undefined;
}): Promise<ResolvedStandaloneConfig> {
  return resolveStandaloneConfig(loadConfig(options));
}

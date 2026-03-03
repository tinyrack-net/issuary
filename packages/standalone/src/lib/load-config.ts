import * as fs from 'node:fs';
import {
  ConfigValidationError,
  parseConfig,
  type ResolvedAppConfig,
  resolveConfig,
} from '@tinyauth/backend/config';
import type { Logger } from '@tinyauth/backend/logger';
import YAML from 'yaml';
import z from 'zod';
import {
  type ResolvedStandaloneConfig,
  type ResolvedStandaloneFrontendConfig,
  type StandaloneAppExtension,
  StandaloneAppExtensionSchema,
  type StandaloneConfig,
  type StandaloneConfigInput,
  type StandaloneFrontendConfig,
} from '#standalone/lib/config/schema.js';
import { resolveEnvVariables } from './interpolate-env.js';
import { resolveAbsolutePath } from './resolve-path.js';

export const DEFAULT_FRONTEND_PROXY_UPSTREAM = 'http://localhost:8081';
export const DEFAULT_FRONTEND_STATIC_PATH = '/opt/tinyauth/frontend';

function parseStandaloneAppExtension(input: unknown): StandaloneAppExtension {
  try {
    return StandaloneAppExtensionSchema.parse(input);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new ConfigValidationError(err.issues);
    }
    throw err;
  }
}

function applyStandaloneFrontendDefaults(
  extension: StandaloneAppExtension,
): StandaloneAppExtension {
  const { frontend } = extension;
  if (!frontend.enabled || frontend.path !== undefined) {
    return extension;
  }

  return {
    ...extension,
    frontend: {
      ...frontend,
      path:
        frontend.mode === 'proxy'
          ? DEFAULT_FRONTEND_PROXY_UPSTREAM
          : DEFAULT_FRONTEND_STATIC_PATH,
    },
  };
}

function buildStandaloneConfig(
  backendConfig: ReturnType<typeof parseConfig>,
  extension: StandaloneAppExtension,
): StandaloneConfig {
  return {
    ...backendConfig,
    app: {
      ...backendConfig.app,
      frontend: extension.frontend,
      html_variables: extension.html_variables,
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

function buildResolvedStandaloneConfig(
  backendConfig: ResolvedAppConfig,
  extension: StandaloneAppExtension,
): ResolvedStandaloneConfig {
  return {
    ...backendConfig,
    app: {
      ...backendConfig.app,
      frontend: resolveStandaloneFrontendConfig(extension.frontend),
      html_variables: extension.html_variables,
    },
  };
}

function parseStandaloneConfig(input: unknown): StandaloneConfig {
  const extension = applyStandaloneFrontendDefaults(
    parseStandaloneAppExtension(input),
  );
  const backendConfig = parseConfig(input);
  return buildStandaloneConfig(backendConfig, extension);
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
  const extension = applyStandaloneFrontendDefaults(
    parseStandaloneAppExtension(input),
  );
  const backendConfig = await resolveConfig(input);
  return buildResolvedStandaloneConfig(backendConfig, extension);
}

export async function loadResolvedConfig(options: {
  configPath: string;
  logger?: Logger | undefined;
}): Promise<ResolvedStandaloneConfig> {
  return resolveStandaloneConfig(loadConfig(options));
}


import 'dotenv/config';
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
import { deepMerge } from './deep-merge.js';
import { resolveEnvVariables } from './interpolate-env.js';
import { resolveAbsolutePath } from './resolve-path.js';

const DEFAULT_CONFIG_PATH = '/opt/config.yaml';
export const DEFAULT_FRONTEND_PROXY_UPSTREAM = 'http://localhost:8081';
export const DEFAULT_FRONTEND_STATIC_PATH = '/opt/tinyauth/frontend';

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
    html_variables: {
      TITLE: '${HTML_TITLE:-Tinyauth}',
      DESCRIPTION: '${HTML_DESCRIPTION:-OIDC for everyone}',
      FAVICON_URL: '${HTML_FAVICON_URL:-/vite.svg}',
    },
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function getStandaloneAppInput(input: unknown): unknown {
  if (!isRecord(input)) {
    return {};
  }

  const app = input['app'];
  if (!isRecord(app)) {
    return {};
  }

  return {
    frontend: app['frontend'],
    html_variables: app['html_variables'],
  };
}

function stripStandaloneAppInput(input: unknown): unknown {
  if (!isRecord(input)) {
    return input;
  }

  const app = input['app'];
  if (!isRecord(app)) {
    return input;
  }

  const backendApp = { ...app };
  Reflect.deleteProperty(backendApp, 'frontend');
  Reflect.deleteProperty(backendApp, 'html_variables');

  return {
    ...input,
    app: backendApp,
  };
}

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
    parseStandaloneAppExtension(getStandaloneAppInput(input)),
  );
  const backendConfig = parseConfig(stripStandaloneAppInput(input));
  return buildStandaloneConfig(backendConfig, extension);
}

const loadConfigFromPath = (configPath: string): StandaloneConfig => {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found at "${configPath}"`);
  }
  const file = fs.readFileSync(configPath, 'utf8');
  const rawConfig = YAML.parse(file);
  const merged = deepMerge(DEFAULT_CONFIG, rawConfig);
  const resolvedConfig = resolveEnvVariables(merged);
  return parseStandaloneConfig(resolvedConfig);
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
 * @param options.logger - Logger instance for config loading messages
 */
export function loadConfig(options?: {
  configPath?: string | undefined;
  defaultConfigPath?: string | undefined;
  logger?: Logger | undefined;
}): StandaloneConfig {
  const logger = options?.logger;
  const defaultConfigPath = options?.defaultConfigPath ?? DEFAULT_CONFIG_PATH;

  // 1. Explicit path provided by caller (e.g., CLI --config-path)
  if (options?.configPath) {
    const configPath = resolveAbsolutePath(options.configPath);
    logger?.info({ configPath }, 'Loading config from file');
    return loadConfigFromPath(configPath);
  }

  // 2. CONFIG_PATH env var is set — error if file missing
  if (process.env['CONFIG_PATH']) {
    const configPath = resolveAbsolutePath(process.env['CONFIG_PATH']);
    logger?.info({ configPath }, 'Loading config from file');
    return loadConfigFromPath(configPath);
  }

  // 3. Default path exists — use it
  if (fs.existsSync(defaultConfigPath)) {
    logger?.info({ configPath: defaultConfigPath }, 'Loading config from file');
    return loadConfigFromPath(defaultConfigPath);
  }

  // 4. Fall back to environment variables with defaults
  logger?.info(
    'No config file found, using environment variables with defaults',
  );
  const resolved = resolveEnvVariables(DEFAULT_CONFIG);
  return parseStandaloneConfig(resolved);
}

export async function resolveStandaloneConfig(
  input: StandaloneConfigInput | StandaloneConfig,
): Promise<ResolvedStandaloneConfig> {
  const extension = applyStandaloneFrontendDefaults(
    parseStandaloneAppExtension(getStandaloneAppInput(input)),
  );
  const backendConfig = await resolveConfig(stripStandaloneAppInput(input));
  return buildResolvedStandaloneConfig(backendConfig, extension);
}

export async function loadResolvedConfig(options?: {
  configPath?: string | undefined;
  defaultConfigPath?: string | undefined;
  logger?: Logger | undefined;
}): Promise<ResolvedStandaloneConfig> {
  return resolveStandaloneConfig(loadConfig(options));
}

export function toBackendConfig(
  config: ResolvedStandaloneConfig,
): ResolvedAppConfig {
  const app = { ...config.app };
  Reflect.deleteProperty(app, 'frontend');
  Reflect.deleteProperty(app, 'html_variables');

  return {
    ...config,
    app,
  };
}

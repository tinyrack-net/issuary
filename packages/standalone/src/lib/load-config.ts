import * as fs from 'node:fs';
import type { TinyAuthConfigs } from '@tinyauth/backend/config';
import { postgres } from '@tinyauth/backend/database/postgres';
import { sqlite } from '@tinyauth/backend/database/sqlite';
import { apple } from '@tinyauth/backend/identity-providers/apple';
import { genericOAuth } from '@tinyauth/backend/identity-providers/generic-oauth';
import { github } from '@tinyauth/backend/identity-providers/github';
import { google } from '@tinyauth/backend/identity-providers/google';
import { nodemailer } from '@tinyauth/backend/mail/nodemailer';
import nm from 'nodemailer';
import YAML from 'yaml';
import {
  type ResolvedStandaloneConfig,
  type ResolvedStandaloneFrontendConfig,
  type StandaloneConfig,
  type StandaloneConfigInput,
  StandaloneConfigSchema,
  type StandaloneFrontendConfig,
} from '#standalone/lib/config/index.js';
import type { Logger } from '#standalone/lib/logger.js';
import { DEFAULT_CONFIG_PATH } from './constants.js';
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

export function parseConfig(input: unknown): StandaloneConfig {
  const config = StandaloneConfigSchema.parse(input);
  return applyFrontendPathDefaults(config);
}

const resolveMailConfig = async (
  smtpInput: StandaloneConfig['smtp'],
): Promise<TinyAuthConfigs['mail']> => {
  if (!smtpInput) {
    return undefined;
  }
  if (smtpInput.test) {
    const testAccount = await nm.createTestAccount();
    return nodemailer({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      user: testAccount.user,
      password: testAccount.pass,
      from: testAccount.user,
      test: true,
    });
  }
  return nodemailer(smtpInput);
};

const composeDatabaseConfig = (
  database: StandaloneConfig['database'],
): TinyAuthConfigs['database'] => {
  switch (database.type) {
    case 'postgres': {
      const { type: _, ...rest } = database;
      return postgres(rest);
    }
    case 'sqlite': {
      const { type: _, ...rest } = database;
      return sqlite(rest);
    }
  }
};

const composeIdentityProvider = (
  config: StandaloneConfig['identity_providers'][number],
): TinyAuthConfigs['identity_providers'][number] => {
  switch (config.type) {
    case 'github': {
      const { type: _, ...rest } = config;
      return github(rest);
    }
    case 'google': {
      const { type: _, ...rest } = config;
      return google(rest);
    }
    case 'apple': {
      const { type: _, ...rest } = config;
      return apple(rest);
    }
    case 'generic_oauth': {
      const { type: _, ...rest } = config;
      return genericOAuth(rest);
    }
  }
};

export async function resolveConfig(input: unknown): Promise<TinyAuthConfigs> {
  const parsed = parseConfig(input);

  const mailConfig = await resolveMailConfig(parsed.smtp);
  const databaseConfig = composeDatabaseConfig(parsed.database);
  const identityProvidersConfig = parsed.identity_providers.map(
    composeIdentityProvider,
  );

  const {
    smtp: _smtp,
    database: _database,
    identity_providers: _idp,
    app: { frontend: _frontend, html_variables: _htmlVars, ...appRest },
    ...rest
  } = parsed;

  return {
    ...rest,
    app: appRest,
    database: databaseConfig,
    identity_providers: identityProvidersConfig,
    ...(mailConfig ? { mail: mailConfig } : {}),
  };
}

/**
 * Load configuration from a YAML config file.
 *
 * @param options - Configuration options
 * @param options.configPath - Path to the config file (required)
 * @param options.logger - Logger instance for config loading messages
 */
export function loadConfig(configPath?: string | undefined): StandaloneConfig {
  const resolvedPath = configPath
    ? resolveAbsolutePath(configPath)
    : DEFAULT_CONFIG_PATH;

  if (fs.existsSync(resolvedPath)) {
    const file = fs.readFileSync(resolvedPath, 'utf8');
    const rawConfig = YAML.parse(file);
    const resolvedConfig = resolveEnvVariables(rawConfig);
    return parseConfig(resolvedConfig);
  } else {
    console.warn(`Config file not found at "${configPath}"`);
    // TODO change
    const defaultConfig: StandaloneConfigInput = {
      app: {},
      security: {
        session_secret:
          'e7e1f64d40b55fd8b5e529b5d85d62e39922d52b4364fc197546efaa72305d24',
        hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      },
    };
    return parseConfig(defaultConfig);
  }
}

export async function resolveStandaloneConfig(
  input: StandaloneConfigInput | StandaloneConfig,
): Promise<ResolvedStandaloneConfig> {
  const parsed = parseConfig(input);
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
  return resolveStandaloneConfig(loadConfig(options.configPath));
}

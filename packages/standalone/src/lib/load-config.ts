import * as fs from 'node:fs';
import {
  ConfigValidationError,
  type ResolvedAppConfig,
} from '@tinyauth/backend/config';
import { postgres } from '@tinyauth/backend/database/postgres';
import { sqlite } from '@tinyauth/backend/database/sqlite';
import { apple } from '@tinyauth/backend/identity-providers/apple';
import { genericOAuth } from '@tinyauth/backend/identity-providers/generic-oauth';
import { github } from '@tinyauth/backend/identity-providers/github';
import { google } from '@tinyauth/backend/identity-providers/google';
import type { Logger } from '@tinyauth/backend/logger';
import { nodemailer } from '@tinyauth/backend/mail/nodemailer';
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

export function parseConfig(input: unknown): StandaloneConfig {
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

const resolveMailConfig = async (
  smtpInput: StandaloneConfig['smtp'],
): Promise<ResolvedAppConfig['mail']> => {
  if (!smtpInput) {
    return undefined;
  }
  if (smtpInput.test) {
    const { default: nm } = await import('nodemailer');
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
): ResolvedAppConfig['database'] => {
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
): ResolvedAppConfig['identity_providers'][number] => {
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

export async function resolveConfig(
  input: unknown,
): Promise<ResolvedAppConfig> {
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

const loadConfigFromPath = (configPath: string): StandaloneConfig => {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found at "${configPath}"`);
  }
  const file = fs.readFileSync(configPath, 'utf8');
  const rawConfig = YAML.parse(file);
  const resolvedConfig = resolveEnvVariables(rawConfig);
  return parseConfig(resolvedConfig);
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
  return resolveStandaloneConfig(loadConfig(options));
}

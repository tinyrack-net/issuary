import * as fs from 'node:fs';
import type { TinyAuthRuntimeConfig } from '@tinyauth/backend/config';
import { postgres } from '@tinyauth/backend/database/postgres';
import { sqlite } from '@tinyauth/backend/database/sqlite';
import { apple } from '@tinyauth/backend/identity-providers/apple';
import { genericOAuth } from '@tinyauth/backend/identity-providers/generic-oauth';
import { github } from '@tinyauth/backend/identity-providers/github';
import { google } from '@tinyauth/backend/identity-providers/google';
import { croner } from '@tinyauth/backend/scheduler/croner';
import YAML from 'yaml';
import type { StandaloneDatabaseConfig } from '#standalone/lib/config/database.js';
import { deepMerge } from '#standalone/lib/config/deep-merge.js';
import { STANDALONE_CONFIG_DEFAULTS } from '#standalone/lib/config/defaults.js';
import type {
  ResolvedStandaloneFrontendConfig,
  StandaloneFrontendConfig,
} from '#standalone/lib/config/frontend.js';
import type { StandaloneIdentityProviderConfig } from '#standalone/lib/config/identity-providers.js';
import {
  type ResolvedStandaloneConfig,
  type StandaloneConfig,
  type StandaloneConfigInput,
  StandaloneConfigSchema,
} from '#standalone/lib/config/resolved.js';
import type { StandaloneSchedulerConfig } from '#standalone/lib/config/scheduler.js';
import type { Logger } from '#standalone/lib/logger.js';
import { DEFAULT_CONFIG_PATH } from './constants.js';
import { resolveEnvVariables } from './interpolate-env.js';
import { resolveAbsolutePath } from './resolve-path.js';

function applyFrontendPathDefaults(config: StandaloneConfig): StandaloneConfig {
  const { frontend } = config;
  if (!frontend.enabled || frontend.path !== undefined) {
    return config;
  }

  return {
    ...config,
    frontend: {
      ...frontend,
      path:
        frontend.mode === 'proxy'
          ? STANDALONE_CONFIG_DEFAULTS.FRONTEND_PROXY_UPSTREAM
          : STANDALONE_CONFIG_DEFAULTS.FRONTEND_STATIC_PATH,
    },
  };
}

function resolveStandaloneFrontendConfig(
  frontend: StandaloneFrontendConfig,
): ResolvedStandaloneFrontendConfig {
  const path =
    frontend.path ??
    (frontend.mode === 'proxy'
      ? STANDALONE_CONFIG_DEFAULTS.FRONTEND_PROXY_UPSTREAM
      : STANDALONE_CONFIG_DEFAULTS.FRONTEND_STATIC_PATH);

  return {
    enabled: frontend.enabled,
    mode: frontend.mode,
    path: frontend.enabled ? path : '',
    html_variables: frontend.html_variables,
  };
}

export function parseConfig(input: unknown): StandaloneConfig {
  const config = StandaloneConfigSchema.parse(input);
  return applyFrontendPathDefaults(config);
}

async function resolveEmailConfig(
  emailInput: StandaloneConfig['email'],
): Promise<TinyAuthRuntimeConfig['email']> {
  if (!emailInput) {
    return undefined;
  }

  if (emailInput.transport === 'test') {
    return {
      from: emailInput.from,
      createTransport: async () => ({
        sendMail: async (message) => ({
          accepted: [message.to],
          envelope: {
            from: message.from ?? emailInput.from,
            to: [message.to],
          },
          messageId: 'standalone-test-email',
        }),
      }),
    };
  }

  return {
    from: emailInput.from,
    createTransport: async () => {
      const { default: nm } = await import('nodemailer');
      const transport = nm.createTransport({
        host: emailInput.host,
        port: emailInput.port,
        secure: emailInput.secure,
        auth: {
          user: emailInput.user,
          pass: emailInput.password,
        },
      });
      return {
        sendMail: (message) => transport.sendMail(message),
      };
    },
  };
}

function composeDatabaseConfig(
  database: StandaloneDatabaseConfig,
): TinyAuthRuntimeConfig['database'] {
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
}

function composeIdentityProvider(
  config: StandaloneIdentityProviderConfig,
): TinyAuthRuntimeConfig['identity_providers'][number] {
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
}

function composeSchedulerConfig(
  scheduler: StandaloneSchedulerConfig,
): TinyAuthRuntimeConfig['scheduler'] {
  if (!scheduler.enabled) {
    return undefined;
  }

  return croner({
    cron: scheduler.cron,
  });
}

export async function resolveConfig(
  input: unknown,
): Promise<TinyAuthRuntimeConfig> {
  const parsed = parseConfig(input);

  const emailConfig = await resolveEmailConfig(parsed.email);
  const databaseConfig = composeDatabaseConfig(parsed.database);
  const schedulerConfig = composeSchedulerConfig(parsed.scheduler);
  const identityProvidersConfig = parsed.identity_providers.map(
    composeIdentityProvider,
  );

  const {
    frontend: _frontend,
    database: _database,
    email: _email,
    identity_providers: _identityProviders,
    scheduler: _scheduler,
    ...rest
  } = parsed;

  return {
    ...rest,
    database: databaseConfig,
    identity_providers: identityProvidersConfig,
    ...(emailConfig ? { email: emailConfig } : {}),
    ...(schedulerConfig ? { scheduler: schedulerConfig } : {}),
  };
}

/**
 * Load configuration from a YAML config file.
 *
 * @param configPath - Path to the config file
 */
export function loadConfig(configPath?: string | undefined): StandaloneConfig {
  const resolvedPath = configPath
    ? resolveAbsolutePath(configPath)
    : DEFAULT_CONFIG_PATH;

  // 1. Start with defaults template (env-var patterns with fallbacks)
  const {
    FRONTEND_PROXY_UPSTREAM: _,
    FRONTEND_STATIC_PATH: __,
    ...configTemplate
  } = STANDALONE_CONFIG_DEFAULTS;
  let merged: Record<string, unknown> = structuredClone(configTemplate);

  // 2. If config file exists, deep-merge user values on top
  if (fs.existsSync(resolvedPath)) {
    const file = fs.readFileSync(resolvedPath, 'utf8');
    const rawConfig = YAML.parse(file) as Record<string, unknown>;
    merged = deepMerge(merged, rawConfig);
  }

  // 3. Resolve env vars (both from defaults template and user YAML)
  const resolved = resolveEnvVariables(merged);

  // 4. Parse with Zod (fails if required fields like security secrets are missing)
  return parseConfig(resolved);
}

export async function resolveStandaloneConfig(
  input: StandaloneConfigInput | StandaloneConfig,
): Promise<ResolvedStandaloneConfig> {
  const parsed = parseConfig(input);
  const backendConfig = await resolveConfig(parsed);

  return {
    ...backendConfig,
    frontend: resolveStandaloneFrontendConfig(parsed.frontend),
  };
}

export async function loadResolvedConfig(options: {
  configPath: string;
  logger?: Logger | undefined;
}): Promise<ResolvedStandaloneConfig> {
  return resolveStandaloneConfig(loadConfig(options.configPath));
}

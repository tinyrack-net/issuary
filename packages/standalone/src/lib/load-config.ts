import * as fs from 'node:fs';
import type { IssuaryRuntimeConfig } from '@tinyrack/issuary-server/config';
import { postgres } from '@tinyrack/issuary-server/database/postgres';
import { sqlite } from '@tinyrack/issuary-server/database/sqlite';
import { apple } from '@tinyrack/issuary-server/identity-providers/apple';
import { genericOAuth } from '@tinyrack/issuary-server/identity-providers/generic-oauth';
import { github } from '@tinyrack/issuary-server/identity-providers/github';
import { google } from '@tinyrack/issuary-server/identity-providers/google';
import { croner } from '@tinyrack/issuary-server/scheduler/croner';
import { database as databaseScheduler } from '@tinyrack/issuary-server/scheduler/database';
import YAML from 'yaml';
import type { StandaloneDatabaseConfig } from './config/database.ts';
import { STANDALONE_CONFIG_DEFAULTS } from './config/defaults.ts';
import type { StandaloneIdentityProviderConfig } from './config/identity-providers.ts';
import {
  type StandaloneConfig,
  StandaloneConfigSchema,
} from './config/resolved.ts';
import type { StandaloneSchedulerConfig } from './config/scheduler.ts';
import { DEFAULT_CONFIG_PATH } from './constants.ts';
import { deepMerge } from './deep-merge.ts';
import { resolveEnvVariables } from './interpolate-env.ts';
import { resolveAbsolutePath } from './resolve-path.ts';

async function composeEmailConfig(
  emailInput: StandaloneConfig['email'],
): Promise<IssuaryRuntimeConfig['email']> {
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
): IssuaryRuntimeConfig['database'] {
  switch (database.type) {
    case 'postgres': {
      const { type: _, driver_options: driverOptions, ...rest } = database;
      return postgres({
        ...rest,
        ...(driverOptions ? { driverOptions } : {}),
      });
    }
    case 'sqlite': {
      const { type: _, ...rest } = database;
      return sqlite(rest);
    }
  }
}

function composeIdentityProvider(
  config: StandaloneIdentityProviderConfig,
): IssuaryRuntimeConfig['identity_providers'][number] {
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
): IssuaryRuntimeConfig['scheduler'] {
  if (!scheduler.enabled) {
    return undefined;
  }

  switch (scheduler.mode) {
    case 'croner':
      return croner({
        cleanupCron: scheduler.cleanup_cron,
      });
    case 'database':
      return databaseScheduler({
        cleanupCron: scheduler.cleanup_cron,
        pollIntervalMs: scheduler.poll_interval_ms,
        lockTtlMs: scheduler.lock_ttl_ms,
        backgroundRetryDelayMs: scheduler.background_retry_delay_ms,
        backgroundMaxAttempts: scheduler.background_max_attempts,
        backgroundRetentionMs: scheduler.background_retention_ms,
        instanceId: scheduler.instance_id,
      });
  }
}

export async function resolveConfig(
  input: unknown,
): Promise<IssuaryRuntimeConfig> {
  const parsed = StandaloneConfigSchema.parse(input);

  const {
    database: _database,
    email: _email,
    identity_providers: _identityProviders,
    scheduler: _scheduler,
    ...rest
  } = parsed;

  return {
    ...rest,
    database: composeDatabaseConfig(parsed.database),
    identity_providers: parsed.identity_providers.map(composeIdentityProvider),
    ...(parsed.email ? { email: await composeEmailConfig(parsed.email) } : {}),
    ...(parsed.scheduler.enabled
      ? { scheduler: composeSchedulerConfig(parsed.scheduler) }
      : {}),
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
  let merged: Record<string, unknown> = structuredClone(
    STANDALONE_CONFIG_DEFAULTS,
  );

  // 2. If config file exists, deep-merge user values on top
  if (fs.existsSync(resolvedPath)) {
    const file = fs.readFileSync(resolvedPath, 'utf8');
    const rawConfig = YAML.parse(file) as Record<string, unknown>;
    merged = deepMerge(merged, rawConfig);
  }

  // 3. Resolve env vars (both from defaults template and user YAML)
  const resolved = resolveEnvVariables(merged);

  // 4. Parse with Zod (fails if required fields like security secrets are missing)
  return StandaloneConfigSchema.parse(resolved);
}

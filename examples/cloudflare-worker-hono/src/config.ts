import {
  type AppConfigInput,
  type ResolvedAppConfig,
  resolveConfig,
} from '@tinyauth/backend/config';

const DEFAULT_APP_HOST = 'http://127.0.0.1:8787';
const DEFAULT_ALLOWED_SIGNUP_EMAILS = ['*'];
const DEFAULT_HTML_TITLE = 'TinyAuth';
const DEFAULT_HTML_DESCRIPTION = 'OIDC for everyone';
const DEFAULT_HTML_FAVICON_URL = '/vite.svg';

export interface AssetFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface CloudflareExampleEnv {
  ASSETS: AssetFetcher;
  APP_HOST?: string | undefined;
  COOKIE_SECRET: string;
  DATABASE_URL: string;
  ALLOWED_SIGNUP_EMAILS?: string | undefined;
  USERS_JSON?: string | undefined;
  CLIENTS_JSON?: string | undefined;
  TERMS_JSON?: string | undefined;
  HTML_TITLE?: string | undefined;
  HTML_DESCRIPTION?: string | undefined;
  HTML_FAVICON_URL?: string | undefined;
  LOG_LEVEL?: string | undefined;
}

function parseJsonArray(value: string | undefined, key: string): unknown[] {
  if (!value || value.trim() === '') {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`${key} must be a JSON array: ${message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${key} must be a JSON array`);
  }

  return parsed;
}

function parseAllowedSignupEmails(value: string | undefined): string[] {
  if (value === undefined) {
    return DEFAULT_ALLOWED_SIGNUP_EMAILS;
  }

  return value
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}

function parseDatabaseUrl(
  databaseUrl: string,
): NonNullable<AppConfigInput['database']> {
  const url = new URL(databaseUrl);
  const protocol = url.protocol.replace(':', '');
  if (protocol !== 'postgres' && protocol !== 'postgresql') {
    throw new Error('DATABASE_URL must use the postgres:// protocol');
  }

  const databaseName = url.pathname.replace(/^\//, '');
  if (databaseName.length === 0) {
    throw new Error('DATABASE_URL must include a database name');
  }

  const port = url.port === '' ? 5432 : Number(url.port);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('DATABASE_URL must include a valid port');
  }

  return {
    type: 'postgres',
    host: url.hostname,
    port,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    name: databaseName,
  };
}

function createLocalizedText(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return {
    ko: value,
    en: value,
    ja: value,
  };
}

export function getHtmlVariables(
  env: Pick<
    CloudflareExampleEnv,
    'HTML_DESCRIPTION' | 'HTML_FAVICON_URL' | 'HTML_TITLE'
  >,
): Record<string, string> {
  return {
    TITLE: env.HTML_TITLE ?? DEFAULT_HTML_TITLE,
    DESCRIPTION: env.HTML_DESCRIPTION ?? DEFAULT_HTML_DESCRIPTION,
    FAVICON_URL: env.HTML_FAVICON_URL ?? DEFAULT_HTML_FAVICON_URL,
  };
}

export async function resolveCloudflareExampleConfig(
  env: CloudflareExampleEnv,
): Promise<ResolvedAppConfig> {
  const localizedTitle = createLocalizedText(env.HTML_TITLE);

  const rawConfig = {
    app: {
      host: env.APP_HOST ?? DEFAULT_APP_HOST,
      cookie_secret: env.COOKIE_SECRET,
      allowed_signup_emails: parseAllowedSignupEmails(
        env.ALLOWED_SIGNUP_EMAILS,
      ),
      supported_languages: ['en', 'ko', 'ja'],
      default_language: 'auto',
      fallback_language: 'en',
      ...(localizedTitle ? { title: localizedTitle } : {}),
    },
    database: parseDatabaseUrl(env.DATABASE_URL),
    logging: {
      level: env.LOG_LEVEL ?? 'info',
      format: 'json',
      http_log_proxy: false,
    },
    scheduler: {
      enabled: false,
      cron: '0 2 * * *',
    },
    users: parseJsonArray(env.USERS_JSON, 'USERS_JSON'),
    clients: parseJsonArray(env.CLIENTS_JSON, 'CLIENTS_JSON'),
    terms: parseJsonArray(env.TERMS_JSON, 'TERMS_JSON'),
  } satisfies AppConfigInput;

  return resolveConfig(rawConfig);
}

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import z from 'zod/v4';
import { zz } from '@/schemas/provider.js';
import { env } from './env.js';

export const AppConfigApp = z.object({
  host: z.string().optional().default('http://localhost:3000'),
  port: zz.PORT.optional().default(8080),
  cookie_secret: z.string().min(16),
  jwt_secret: z.string().min(32).optional(),
  jwt_access_token_ttl: z.number().int().min(60).optional().default(3600), // 1 hour
  jwt_refresh_token_ttl: z.number().int().min(3600).optional().default(2592000), // 30 days
});

export type AppConfigApp = z.infer<typeof AppConfigApp>;

export const AppConfigAdmin = z.discriminatedUnion('enabled', [
  z.object({
    enabled: z.literal(false),
  }),
  z.object({
    enabled: z.literal(true),
    port: zz.PORT.optional().default(8081),
  }),
]);

export type AppConfigAdmin = z.infer<typeof AppConfigAdmin>;

export const AppConfigDatabase = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(['sqlite']).default('sqlite'),
    path: z.string().default('test.db'),
  }),
  z.object({
    type: z.literal(['postgres']).default('postgres'),
    host: z.string().default('localhost'),
    port: zz.PORT.default(5432),
    user: z.string().min(1).default('test'),
    password: z.string().min(1).default('test'),
    name: z.string().min(1).default('test'),
  }),
]);

export type AppConfigDatabase = z.infer<typeof AppConfigDatabase>;

export const AppConfigSmtp = z.discriminatedUnion('enabled', [
  z.object({
    enabled: z.literal(false),
  }),
  z.object({
    enabled: z.literal(true),
    host: z.string().default('localhost'),
    port: zz.PORT.default(587),
    secure: z.boolean().default(true),
    user: z.string().min(1),
    password: z.string().min(1),
    from: z.email(),
  }),
]);

export type AppConfigSmtp = z.infer<typeof AppConfigSmtp>;

export const AppConfigProvider = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  redirect_uris: z.array(z.string()).min(1),
  response_types: z.array(z.string()).min(1),
  grant_types: z.array(z.string()).min(1),
  scope: z.string().min(1),
});

export type AppConfigProvider = z.infer<typeof AppConfigProvider>;

export const AppConfigUser = z.object({
  id: z.string().min(1),
  email: z.email(),
  password: z.string().min(6).max(100),
  totp_secret: z.string().min(16).max(128).optional(),
  totp_backup_codes: z.array(z.string()).optional(),
});

export type AppConfigUser = z.infer<typeof AppConfigUser>;

export const ConfigSchema = z.object({
  app: AppConfigApp,
  admin: AppConfigAdmin.default({
    enabled: false,
  }).optional(),
  database: AppConfigDatabase.default({
    type: 'sqlite',
    path: 'test.db',
  }),
  smtp: AppConfigSmtp.default({
    enabled: false,
  }).optional(),
  providers: z.array(AppConfigProvider).default([]),
  users: z.array(AppConfigUser).default([]),
});

const resolveConfigPath = () => {
  const configPath = env.CONFIG_PATH || DEFAULT_CONFIG_PATH;
  if (path.isAbsolute(configPath)) {
    return configPath;
  } else {
    return path.resolve(process.cwd(), configPath);
  }
};

const loadConfig = (path: string) => {
  if (!existsSync(path)) {
    throw new Error(`Config file not found at "${path}"`);
  }
  const file = readFileSync(path, 'utf8');
  const config = YAML.parse(file, {
    customTags: [
      {
        tag: '!env',
        resolve: (str: string) => process.env[str],
      },
    ],
  });
  const parsed = ConfigSchema.parse(config);

  parsed.app.host = env.APP_HOST ?? parsed.app.host;
  parsed.app.port = env.APP_PORT ?? parsed.app.port;

  if (parsed.admin?.enabled) {
    parsed.admin.port = env.ADMIN_PORT ?? parsed.admin.port;
  }

  const databaseType = env.DATABASE_TYPE ?? parsed.database.type;

  if (databaseType === 'postgres') {
    if (parsed.database.type === 'postgres') {
      parsed.database.host = env.DATABASE_HOST ?? parsed.database.host;
      parsed.database.name = env.DATABASE_NAME ?? parsed.database.name;
      parsed.database.password =
        env.DATABASE_PASSWORD ?? parsed.database.password;
      parsed.database.user = env.DATABASE_USER ?? parsed.database.user;
      parsed.database.port = env.DATABASE_PORT ?? parsed.database.port;
    }
  } else if (databaseType === 'sqlite') {
    if (parsed.database.type === 'sqlite') {
      parsed.database.path = env.DATABASE_PATH ?? parsed.database.path;
    }
  }

  if (parsed.smtp?.enabled) {
    parsed.smtp.from = env.SMTP_FROM ?? parsed.smtp.from;
    parsed.smtp.user = env.SMTP_USER ?? parsed.smtp.user;
    parsed.smtp.password = env.SMTP_PASSWORD ?? parsed.smtp.password;
    parsed.smtp.secure = env.SMTP_SECURE ?? parsed.smtp.secure;
    parsed.smtp.host = env.SMTP_HOST ?? parsed.smtp.host;
    parsed.smtp.port = env.SMTP_PORT ?? parsed.smtp.port;
  }

  return ConfigSchema.parse(parsed);
};

const DEFAULT_CONFIG_PATH = '/opt/config.yaml';
const CONFIG_PATH = resolveConfigPath();

export const AppConfigs = loadConfig(CONFIG_PATH);

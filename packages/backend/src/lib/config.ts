import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import z from 'zod/v4';
import { zz } from '@/schemas/provider.js';
import { env } from './env.js';

export const ConfigSchema = z.object({
  app: z.object({
    host: z.string().optional().default('http://localhost:3000'),
    port: zz.PORT.optional().default(8080),
    cookie_secret: z.string().min(16),
  }),
  admin: z
    .discriminatedUnion('enabled', [
      z.object({
        enabled: z.literal(false),
      }),
      z.object({
        enabled: z.literal(true),
        port: zz.PORT.optional().default(8081),
      }),
    ])
    .default({
      enabled: false,
    })
    .optional(),
  database: z
    .discriminatedUnion('type', [
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
    ])
    .default({
      type: 'sqlite',
      path: 'test.db',
    }),
  smtp: z
    .discriminatedUnion('enabled', [
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
    ])
    .default({
      enabled: false,
    })
    .optional(),
  providers: z
    .record(
      z.string(),
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        client_id: z.string().min(1),
        client_secret: z.string().min(1),
        redirect_uris: z.array(z.string()).min(1),
        response_types: z.array(z.string()).min(1),
        grant_types: z.array(z.string()).min(1),
        scope: z.string().min(1),
      }),
    )
    .optional(),
  users: z
    .array(
      z.object({
        id: z.string().min(1),
        email: z.email(),
        password: z.string().min(6).max(100),
        totp_secret: z.string().min(16).max(128).optional(),
        totp_backup_codes: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  debug: z.object({
    test_mode: z.boolean().default(false).optional(),
  }).default({
    test_mode: false,
  }),
});

export type UserConfig = NonNullable<
  z.infer<typeof ConfigSchema>['users']
>[number];

export type SMTPConfig = z.infer<typeof ConfigSchema>['smtp'];

export type ProviderConfig = NonNullable<
  z.infer<typeof ConfigSchema>['providers']
>[string];

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

  if (parsed.debug.test_mode) {
    parsed.database = {
      type: 'sqlite',
      path: './test.db'
    }
  }

  return ConfigSchema.parse(parsed);
};

const DEFAULT_CONFIG_PATH = '/opt/config.yaml';
const CONFIG_PATH = resolveConfigPath();

export const AppConfigs = loadConfig(CONFIG_PATH);


import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
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
  public_registration: z
    .boolean()
    .default(true)
    .describe('Allow public user registration'),
  supported_languages: z
    .array(z.string())
    .default(['en'])
    .describe('Supported languages'),
  default_language: z.string().default('auto').describe('Default language'),
  fallback_language: z.string().default('en').describe('Fallback language'),
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

export const AppConfigAuthenticationMethod = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('password'),
    enabled: z.boolean().default(true),
  }),
  z.object({
    type: z.literal('github'),
    enabled: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('oauth'),
    enabled: z.boolean().default(false),
  }),
]);

export const AppConfigSmtp = z.object({
  host: z.string().default('localhost'),
  port: zz.PORT.default(465),
  secure: z.boolean().default(true),
  user: z.string().min(1),
  password: z.string().min(1),
  from: z.email(),
  test: z.boolean().default(false),
});

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
  authentication_methods: z
    .record(z.string(), AppConfigAuthenticationMethod)
    .default({
      email: {
        type: 'password',
        enabled: true,
      },
    }),
  smtp: z.discriminatedUnion('test', [
    AppConfigSmtp.extend({
      test: z.literal(false),
    }),
    z.object({
      test: z.literal(true),
    }),
  ]),
  providers: z.array(AppConfigProvider).default([]),
  users: z.array(AppConfigUser).default([]),
});

export const InternalConfigSchema = z.object({
  app: AppConfigApp,
  admin: AppConfigAdmin.default({
    enabled: false,
  }).optional(),
  database: AppConfigDatabase.default({
    type: 'sqlite',
    path: 'test.db',
  }),
  authentication_methods: z
    .record(z.string(), AppConfigAuthenticationMethod)
    .default({
      email: {
        type: 'password',
        enabled: true,
      },
    }),
  smtp: AppConfigSmtp,
  providers: z.array(AppConfigProvider).default([]),
  users: z.array(AppConfigUser).default([]),
});

const resolveConfigPath = () => {
  const configPath =
    env.APP_ENV === 'test'
      ? './config.test.yaml'
      : env.CONFIG_PATH || DEFAULT_CONFIG_PATH;
  if (path.isAbsolute(configPath)) {
    return configPath;
  } else {
    return path.resolve(process.cwd(), configPath);
  }
};

const loadConfig = async (path: string) => {
  if (!existsSync(path)) {
    throw new Error(`Config file not found at "${path}"`);
  }
  const file = readFileSync(path, 'utf8');
  const rawConfig = YAML.parse(file, {
    customTags: [
      {
        tag: '!env',
        resolve: (str: string) => process.env[str],
      },
    ],
  });
  const parsed = ConfigSchema.parse(rawConfig);

  const smtpConfig = await (async () => {
    if (parsed.smtp.test) {
      const testAccount = await nodemailer.createTestAccount();
      return {
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        user: testAccount.user,
        password: testAccount.pass,
        from: testAccount.user,
        test: true,
      };
    } else {
      return parsed.smtp;
    }
  })();

  return InternalConfigSchema.parse({
    ...parsed,
    smtp: smtpConfig,
  });
};

const DEFAULT_CONFIG_PATH = '/opt/config.yaml';
const CONFIG_PATH = resolveConfigPath();

console.info(`Loading config from: ${CONFIG_PATH}`);

export const AppConfigs = await loadConfig(CONFIG_PATH);

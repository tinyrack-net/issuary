import z from 'zod';
import { zz } from '../../schemas/provider.ts';
import type { FrontendConfig } from './frontend.ts';

type AdminConfigDefault = {
  enabled: false;
  mode: 'same-port';
  mount_path: '/admin';
  bind_host: '127.0.0.1';
  frontend_mode: 'static';
};

export const ADMIN_CONFIG_DEFAULT: AdminConfigDefault = {
  enabled: false,
  mode: 'same-port',
  mount_path: '/admin',
  bind_host: '127.0.0.1',
  frontend_mode: 'static',
};

export const AdminConfigSchema = z
  .object({
    enabled: zz.COERCE_BOOLEAN.default(ADMIN_CONFIG_DEFAULT.enabled),
    mode: z
      .enum(['same-port', 'separate-port'])
      .default(ADMIN_CONFIG_DEFAULT.mode),
    mount_path: z
      .string()
      .regex(/^\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/)
      .default(ADMIN_CONFIG_DEFAULT.mount_path),
    bind_host: z.string().trim().min(1).default(ADMIN_CONFIG_DEFAULT.bind_host),
    listen_port: zz.PORT.optional(),
    public_origin: z.string().url().optional(),
    frontend_mode: z
      .enum(['proxy', 'static'])
      .default(ADMIN_CONFIG_DEFAULT.frontend_mode),
    frontend_path: z.string().trim().min(1).optional(),
    frontend: z
      .custom<FrontendConfig>((val) => typeof val === 'function', {
        message: 'Invalid FrontendConfig: must be a function',
      })
      .optional(),
  })
  .strict()
  .superRefine((config, ctx) => {
    if (
      config.enabled &&
      config.mode === 'separate-port' &&
      config.listen_port === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['listen_port'],
        message: 'Admin separate-port mode requires listen_port.',
      });
    }
  })
  .default(ADMIN_CONFIG_DEFAULT)
  .describe('Admin UI and API settings.');

export type AdminConfig = z.infer<typeof AdminConfigSchema>;

import { zz } from '@/schemas/provider.js';
import 'dotenv/config';
import z from 'zod';

export const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  CONFIG_PATH: z.string().optional(),

  APP_HOST: z.string().optional(),
  APP_PORT: zz.PORT.optional(),

  ADMIN_PORT: zz.PORT.optional(),

  DATABASE_TYPE: z.literal(['postgres']).optional(),
  DATABASE_HOST: z.string().optional(),
  DATABASE_PORT: zz.PORT.optional(),
  DATABASE_PATH: z.string().optional(),
  DATABASE_USER: z.string().optional(),
  DATABASE_PASSWORD: z.string().optional(),
  DATABASE_NAME: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: zz.PORT.optional(),
  SMTP_SECURE: z.boolean().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export const env = EnvironmentSchema.parse(process.env);

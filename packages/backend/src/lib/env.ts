import { zz } from '@/schemas/provider.js';
import 'dotenv/config';
import z from 'zod';

export const EnvironmentSchema = z.object({
  /**
   * @description
   * The application environment
   *
   * Options:
   * - test: Used for running tests
   * - development: Used for local development
   * - production: Used for production deployments
   */
  APP_ENV: z.enum(['test', 'development', 'production']).default('development'),

  /**
   * @description
   * Path to the configuration file
   */
  CONFIG_PATH: z.string().optional(),

  /**
   * @description
   * Application host and port
   */
  APP_HOST: z.string().optional(),

  /**
   * @description
   * Application port
   */
  APP_PORT: zz.PORT.optional(),

  /**
   * @description
   * Admin port
   */
  ADMIN_PORT: zz.PORT.optional(),

  /**
   * @description
   * Database configuration
   */
  DATABASE_TYPE: z.literal(['postgres']).optional(),
  DATABASE_HOST: z.string().optional(),
  DATABASE_PORT: zz.PORT.optional(),
  DATABASE_PATH: z.string().optional(),
  DATABASE_USER: z.string().optional(),
  DATABASE_PASSWORD: z.string().optional(),
  DATABASE_NAME: z.string().optional(),

  /**
   * @description
   * SMTP configuration
   */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: zz.PORT.optional(),
  SMTP_SECURE: z.boolean().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export const env = EnvironmentSchema.parse(process.env);

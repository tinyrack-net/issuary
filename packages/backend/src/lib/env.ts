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
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export const env = EnvironmentSchema.parse(process.env);

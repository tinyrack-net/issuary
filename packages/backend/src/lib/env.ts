import 'dotenv/config';
import z from 'zod';

const EnvironmentSchema = z.object({
  /**
   * @description
   * The application environment
   *
   * Options:
   * - development: Used for local development
   * - production: Used for production deployments
   */
  APP_ENV: z.enum(['development', 'production']).default('development'),

  /**
   * @description
   * Path to the configuration file
   */
  CONFIG_PATH: z.string().optional(),
});

export const env = EnvironmentSchema.parse(process.env);

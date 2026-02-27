import 'dotenv/config';
import z from 'zod';

const EnvironmentSchema = z.object({
  /**
   * @description
   * Path to the configuration file
   */
  CONFIG_PATH: z.string().optional(),
});

export const env = EnvironmentSchema.parse(process.env);

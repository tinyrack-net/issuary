import { LoggingConfigSchema } from '@tinyrack/tinyauth-server/config';
import type z from 'zod';

export const StandaloneLoggingConfigSchema = LoggingConfigSchema;

export type StandaloneLoggingConfig = z.infer<
  typeof StandaloneLoggingConfigSchema
>;

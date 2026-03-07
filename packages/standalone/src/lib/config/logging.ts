import { LoggingConfigSchema } from '@tinyauth/backend/config';
import type z from 'zod';

export const StandaloneLoggingConfigSchema = LoggingConfigSchema;

export type StandaloneLoggingConfig = z.infer<
  typeof StandaloneLoggingConfigSchema
>;

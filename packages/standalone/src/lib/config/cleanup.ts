import { CleanupConfigSchema } from '@tinyrack/issuary-server/config';
import type z from 'zod';

export const StandaloneCleanupConfigSchema = CleanupConfigSchema;

export type StandaloneCleanupConfig = z.infer<
  typeof StandaloneCleanupConfigSchema
>;

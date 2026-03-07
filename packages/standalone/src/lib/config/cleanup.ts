import { CleanupConfigSchema } from '@tinyauth/backend/config';
import type z from 'zod';

export const StandaloneCleanupConfigSchema = CleanupConfigSchema;

export type StandaloneCleanupConfig = z.infer<
  typeof StandaloneCleanupConfigSchema
>;

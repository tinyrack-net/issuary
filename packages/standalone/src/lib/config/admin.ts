import { AdminConfigSchema } from '@tinyrack/issuary-server/config';
import type z from 'zod';

export const StandaloneAdminConfigSchema = AdminConfigSchema;
export type StandaloneAdminConfig = z.infer<typeof StandaloneAdminConfigSchema>;

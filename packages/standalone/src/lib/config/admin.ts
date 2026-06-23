import { AdminConfigSchema } from '@tinyrack/tinyauth-server/config';
import type z from 'zod';

export const StandaloneAdminConfigSchema = AdminConfigSchema;
export type StandaloneAdminConfig = z.infer<typeof StandaloneAdminConfigSchema>;

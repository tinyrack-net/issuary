import { SecurityConfigSchema } from '@tinyauth/backend/config';
import type z from 'zod';

export const StandaloneSecurityConfigSchema = SecurityConfigSchema.extend({});

export type StandaloneSecurityConfig = z.infer<
  typeof StandaloneSecurityConfigSchema
>;

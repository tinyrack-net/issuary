import { AuthConfigSchema } from '@tinyauth/backend/config';
import type z from 'zod';

export const StandaloneAuthConfigSchema = AuthConfigSchema;

export type StandaloneAuthConfig = z.infer<typeof StandaloneAuthConfigSchema>;

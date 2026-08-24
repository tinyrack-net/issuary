import { AuthConfigSchema } from '@tinyrack/issuary-server/config';
import type z from 'zod';

export const StandaloneAuthConfigSchema = AuthConfigSchema;

export type StandaloneAuthConfig = z.infer<typeof StandaloneAuthConfigSchema>;

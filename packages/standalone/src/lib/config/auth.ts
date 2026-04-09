import { AuthConfigSchema } from '@tinyrack/tinyauth-server/config';
import type z from 'zod';

export const StandaloneAuthConfigSchema = AuthConfigSchema;

export type StandaloneAuthConfig = z.infer<typeof StandaloneAuthConfigSchema>;

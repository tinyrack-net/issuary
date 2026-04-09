import { TermsConfigSchema } from '@tinyrack/tinyauth-server/config';
import type z from 'zod';

export const StandaloneTermsConfigSchema = TermsConfigSchema;

export type StandaloneTermsConfig = z.infer<typeof StandaloneTermsConfigSchema>;

import { AppConfigSchema } from '@tinyauth/backend/config';
import z from 'zod';
import { StandaloneFrontendConfigSchema } from './frontend.js';

export const StandaloneAppConfigSchema = AppConfigSchema.extend({
  frontend: StandaloneFrontendConfigSchema.default({
    enabled: true,
    mode: 'static',
  }),
  html_variables: z.record(z.string(), z.string()).default({}),
});

export type StandaloneAppConfig = z.infer<typeof StandaloneAppConfigSchema>;

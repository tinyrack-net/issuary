import {
  TinyAuthDeclarativeConfigSchema,
  type TinyAuthRuntimeConfig,
} from '@tinyauth/backend/config';
import type z from 'zod';
import {
  type ResolvedStandaloneFrontendConfig,
  STANDALONE_FRONTEND_CONFIG_DEFAULT,
  StandaloneFrontendConfigSchema,
} from './frontend.js';

export const StandaloneConfigSchema = TinyAuthDeclarativeConfigSchema.extend({
  frontend: StandaloneFrontendConfigSchema.default({
    ...STANDALONE_FRONTEND_CONFIG_DEFAULT,
    html_variables: {
      ...STANDALONE_FRONTEND_CONFIG_DEFAULT.html_variables,
    },
  }),
}).strict();

export type StandaloneConfigInput = z.input<typeof StandaloneConfigSchema>;
export type StandaloneConfig = z.infer<typeof StandaloneConfigSchema>;

export type ResolvedStandaloneConfig = Omit<
  TinyAuthRuntimeConfig,
  'frontend'
> & {
  frontend: ResolvedStandaloneFrontendConfig;
};

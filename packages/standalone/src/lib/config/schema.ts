import {
  AppConfigApp,
  AppConfigSchema,
  type ResolvedAppConfig,
} from '@tinyauth/backend/config';
import z from 'zod';

export const StandaloneFrontendConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(['proxy', 'static']).default('static'),
  path: z.string().optional(),
});

export type StandaloneFrontendConfigInput = z.input<
  typeof StandaloneFrontendConfigSchema
>;
export type StandaloneFrontendConfig = z.infer<
  typeof StandaloneFrontendConfigSchema
>;

export type ResolvedStandaloneFrontendConfig = {
  enabled: boolean;
  mode: 'proxy' | 'static';
  path: string;
};

const StandaloneAppSchema = AppConfigApp.extend({
  frontend: StandaloneFrontendConfigSchema.default({
    enabled: true,
    mode: 'static',
  }),
  html_variables: z.record(z.string(), z.string()).default({}),
});

export const StandaloneConfigSchema = AppConfigSchema.safeExtend({
  app: StandaloneAppSchema,
});

export type StandaloneConfigInput = z.input<typeof StandaloneConfigSchema>;
export type StandaloneConfig = z.infer<typeof StandaloneConfigSchema>;

export type ResolvedStandaloneConfig = Omit<ResolvedAppConfig, 'app'> & {
  app: ResolvedAppConfig['app'] & {
    frontend: ResolvedStandaloneFrontendConfig;
    html_variables: Record<string, string>;
  };
};

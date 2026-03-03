import type {
  AppConfig,
  AppConfigInput,
  ResolvedAppConfig,
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

export const StandaloneAppExtensionSchema = z.object({
  frontend: StandaloneFrontendConfigSchema.default({
    enabled: true,
    mode: 'static',
  }),
  html_variables: z.record(z.string(), z.string()).default({}),
});

export type StandaloneAppExtension = z.infer<
  typeof StandaloneAppExtensionSchema
>;

export type StandaloneConfigInput = Omit<AppConfigInput, 'app'> & {
  app: AppConfigInput['app'] & {
    frontend?: StandaloneFrontendConfigInput | undefined;
    html_variables?: Record<string, string> | undefined;
  };
};

export type StandaloneConfig = Omit<AppConfig, 'app'> & {
  app: AppConfig['app'] & {
    frontend: StandaloneFrontendConfig;
    html_variables: Record<string, string>;
  };
};

export type ResolvedStandaloneConfig = Omit<ResolvedAppConfig, 'app'> & {
  app: ResolvedAppConfig['app'] & {
    frontend: ResolvedStandaloneFrontendConfig;
    html_variables: Record<string, string>;
  };
};

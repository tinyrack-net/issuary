import z from 'zod';
import { StandaloneBooleanSchema } from './coerce.js';

export const STANDALONE_FRONTEND_CONFIG_DEFAULT = {
  enabled: true,
  mode: 'static',
  html_variables: {},
} as const;

export const StandaloneFrontendConfigSchema = z
  .object({
    enabled: StandaloneBooleanSchema.default(
      STANDALONE_FRONTEND_CONFIG_DEFAULT.enabled,
    ),
    mode: z
      .enum(['proxy', 'static'])
      .default(STANDALONE_FRONTEND_CONFIG_DEFAULT.mode),
    path: z.string().optional(),
    html_variables: z
      .record(z.string(), z.string())
      .default(STANDALONE_FRONTEND_CONFIG_DEFAULT.html_variables),
  })
  .strict()
  .default(STANDALONE_FRONTEND_CONFIG_DEFAULT);

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
  html_variables: Record<string, string>;
};

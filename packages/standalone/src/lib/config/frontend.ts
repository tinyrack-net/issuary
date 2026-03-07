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

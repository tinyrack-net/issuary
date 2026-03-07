import z from 'zod';

export const StandaloneUserConfigSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  password: z.string().min(1).max(256),
  role: z.enum(['user', 'admin']).default('user'),
});

export const StandaloneUserConfigsSchema = z
  .array(StandaloneUserConfigSchema)
  .default([]);

export type StandaloneUserConfig = z.infer<typeof StandaloneUserConfigSchema>;

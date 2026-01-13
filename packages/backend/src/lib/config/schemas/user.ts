import z from 'zod/v4';

export const AppConfigUser = z.object({
  id: z.string().min(1),
  email: z.email(),
  password: z.string().min(6).max(100),
  role: z.enum(['user', 'admin']).default('user'),
});

export type AppConfigUser = z.infer<typeof AppConfigUser>;

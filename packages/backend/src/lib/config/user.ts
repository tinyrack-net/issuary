import z from 'zod';

export const UserConfigSchema = z.object({
  sub: z.string(),
  email: z.string(),
  password: z.string(),
  role: z.enum(['user', 'admin']),
});

export type UserConfig = z.infer<typeof UserConfigSchema>;

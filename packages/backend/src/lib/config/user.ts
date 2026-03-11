import z from 'zod';

export const UserConfigSchema = z
  .object({
    sub: z.string(),
    email: z.string(),
    password: z.string(),
    role: z.enum(['user', 'admin']),
  })
  .strict();

export type UserConfig = z.infer<typeof UserConfigSchema>;

export const USER_CONFIGS_DEFAULT: UserConfig[] = [];

export const UserConfigsSchema = z
  .array(UserConfigSchema)
  .default(USER_CONFIGS_DEFAULT);

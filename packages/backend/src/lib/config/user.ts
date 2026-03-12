import z from 'zod';

export const UserConfigSchema = z
  .object({
    sub: z.string().describe('Unique subject identifier for the user.'),
    email: z.string().describe('Email address for the user account.'),
    password: z.string().describe('Plain-text password (hashed at startup).'),
    role: z
      .enum(['user', 'admin'])
      .describe('User role. "admin" grants access to the admin panel.'),
  })
  .strict()
  .describe('Pre-provisioned user account configuration.');

export type UserConfig = z.infer<typeof UserConfigSchema>;

export const USER_CONFIGS_DEFAULT: UserConfig[] = [];

export const UserConfigsSchema = z
  .array(UserConfigSchema)
  .default(USER_CONFIGS_DEFAULT)
  .describe('List of pre-provisioned user accounts.');

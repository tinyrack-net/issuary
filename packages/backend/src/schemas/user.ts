import z from 'zod/v4';

export const UserSessionSchema = z.object({
  id: z.string(),
  email: z.email(),
  email_verified: z.boolean(),
});

import z from 'zod/v4';

export const UserSessionSchema = z
  .object({
    id: z.string().describe('User ID'),
    email: z.email().describe('User email address'),
    email_verified: z
      .boolean()
      .describe("Whether the user's email is verified"),
  })
  .describe('UserSession');

import z from 'zod/v4';

export const f = {
  userId: z.string().describe('User ID'),
  userEmail: z.email().describe('User email address'),
  emailVerified: z.boolean().describe("Whether the user's email is verified"),
};

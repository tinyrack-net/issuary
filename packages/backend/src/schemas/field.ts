import z from 'zod/v4';

export const f = {
  userId: z.string().describe('User ID'),
  userEmail: z.email().describe('User email address'),
  userPassword: z.string().min(6).max(100).describe("User's password"),
  emailVerified: z.boolean().describe("Whether the user's email is verified"),
};

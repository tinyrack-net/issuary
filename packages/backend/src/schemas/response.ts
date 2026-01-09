import z from 'zod/v4';
import { f } from './field.js';

export const r = {
  UserSession: z
    .object({
      id: f.userId,
      email: f.userEmail,
      email_verified: f.emailVerified,
    })
    .describe('UserSession'),
};

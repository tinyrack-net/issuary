import z from 'zod/v4';
import { f } from './field.js';

export const r = {
  UserSession: z
    .object({
      managed: z.literal(['database', 'config']),
      id: f.userId,
      email: f.userEmail,
      email_verified: f.emailVerified,
    })
    .describe('UserSession'),
};

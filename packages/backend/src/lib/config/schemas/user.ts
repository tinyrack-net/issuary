import z from 'zod/v4';
import { f } from '@/schemas/field.js';

export const AppConfigUser = z.object({
  id: z.string().min(1),
  email: f.userEmail,
  password: f.userPassword,
  role: z.enum(['user', 'admin']).optional().default('user'),
});

export type AppConfigUser = z.infer<typeof AppConfigUser>;

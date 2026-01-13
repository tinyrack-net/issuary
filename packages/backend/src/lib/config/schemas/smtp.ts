import z from 'zod/v4';
import { zz } from '@/schemas/provider.js';

export const AppConfigSmtp = z.object({
  host: z.string().default('localhost'),
  port: zz.PORT.default(465),
  secure: z.boolean().default(true),
  user: z.string().min(1),
  password: z.string().min(1),
  from: z.email(),
  test: z.boolean().default(false),
});

export type AppConfigSmtp = z.infer<typeof AppConfigSmtp>;

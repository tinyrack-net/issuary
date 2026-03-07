import z from 'zod';
import { fromBase64Url } from '#backend/lib/base64url.js';

export const AppConfigSecurity = z
  .object({
    hash_master_secret: z
      .string()
      .min(1)
      .superRefine((value, ctx) => {
        try {
          const decoded = fromBase64Url(value);
          if (decoded.length !== 32) {
            ctx.addIssue({
              code: 'custom',
              message:
                'hash_master_secret must be a base64url-encoded 32-byte secret',
            });
          }
        } catch {
          ctx.addIssue({
            code: 'custom',
            message:
              'hash_master_secret must be a valid base64url-encoded secret',
          });
        }
      }),
    pbkdf2_iterations: z.number().int().min(1).default(600000),
  })
  .strict();

export type AppConfigSecurity = z.infer<typeof AppConfigSecurity>;

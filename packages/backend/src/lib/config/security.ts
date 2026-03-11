import z from 'zod';
import { fromBase64Url } from '#backend/lib/base64url.js';
import { zz } from '#backend/schemas/provider.js';

export const SECURITY_CONFIG_DEFAULT = {
  pbkdf2_iterations: 600000,
};

export const SecurityConfigSchema = z
  .object({
    session_secret: z.string().min(16),
    hash_secret: z
      .string()
      .min(1)
      .superRefine((value, ctx) => {
        try {
          const decoded = fromBase64Url(value);
          if (decoded.length !== 32) {
            ctx.addIssue({
              code: 'custom',
              message: 'hash_secret must be a base64url-encoded 32-byte secret',
            });
          }
        } catch {
          ctx.addIssue({
            code: 'custom',
            message: 'hash_secret must be a valid base64url-encoded secret',
          });
        }
      }),
    pbkdf2_iterations: z
      .union([z.string(), z.number()])
      .pipe(zz.coerceInt().pipe(z.number().int().min(1)))
      .default(SECURITY_CONFIG_DEFAULT.pbkdf2_iterations),
  })
  .strict();

export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

import z from 'zod';
import { zz } from '../../schemas/provider.ts';
import { fromBase64Url } from '../base64url.ts';

export const SECURITY_CONFIG_DEFAULT = {
  pbkdf2_iterations: 600000,
};

export const SecurityConfigSchema = z
  .object({
    session_secret: z
      .string()
      .min(16)
      .describe(
        'Secret key for signing session cookies. Must be at least 16 characters.',
      ),
    hash_secret: z
      .string()
      .min(1)
      .describe('Base64url-encoded 32-byte secret used for HMAC hashing.')
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
      .default(SECURITY_CONFIG_DEFAULT.pbkdf2_iterations)
      .describe('Number of PBKDF2 iterations for password hashing.'),
  })
  .strict()
  .describe('Security configuration for secrets and cryptographic settings.');

export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

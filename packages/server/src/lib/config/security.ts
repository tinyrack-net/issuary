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
      .min(1)
      .describe(
        'Hex-encoded secret key for encrypting session cookies (AES-GCM). Must decode to 16, 24, or 32 bytes (32, 48, or 64 hex characters) for AES-128/192/256.',
      )
      .superRefine((value, ctx) => {
        if (!/^[0-9a-fA-F]+$/.test(value)) {
          ctx.addIssue({
            code: 'custom',
            message:
              'session_secret must be a valid hex string (only 0-9, a-f, A-F characters)',
          });
          return;
        }
        if (value.length % 2 !== 0) {
          ctx.addIssue({
            code: 'custom',
            message:
              'session_secret must have an even number of hex characters',
          });
          return;
        }
        const byteLength = value.length / 2;
        if (![16, 24, 32].includes(byteLength)) {
          ctx.addIssue({
            code: 'custom',
            message: `session_secret must decode to 16, 24, or 32 bytes for AES-128/192/256, got ${byteLength} bytes (${value.length} hex characters)`,
          });
        }
      }),
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

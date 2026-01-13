import z from 'zod/v4';

/**
 * Password authentication configuration (fixed type).
 */
export const AppConfigPasswordAuth = z.object({
  enabled: z.boolean().default(true),
  email_verification: z.boolean().default(true),
  totp: z
    .object({
      enabled: z.boolean().default(false),
      required: z.boolean().default(false),
    })
    .optional(),
});

export type AppConfigPasswordAuth = z.infer<typeof AppConfigPasswordAuth>;

/**
 * Passkey (WebAuthn) authentication configuration (fixed type).
 */
export const AppConfigPasskeyAuth = z.object({
  enabled: z.boolean().default(false),
  email_verification: z.boolean().default(true),
});

export type AppConfigPasskeyAuth = z.infer<typeof AppConfigPasskeyAuth>;

/**
 * Basic authentication methods configuration (fixed structure).
 * Contains password and passkey authentication settings.
 */
export const AppConfigBasicAuthenticationMethods = z.object({
  password: AppConfigPasswordAuth.default({
    enabled: true,
    email_verification: true,
  }),
  passkey: AppConfigPasskeyAuth.default({
    enabled: false,
    email_verification: true,
  }),
});

export type AppConfigBasicAuthenticationMethods = z.infer<
  typeof AppConfigBasicAuthenticationMethods
>;

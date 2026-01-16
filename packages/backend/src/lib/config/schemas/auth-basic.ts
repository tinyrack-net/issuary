import z from 'zod/v4';

/**
 * Second factor configuration for password authentication.
 * Determines if users must set up 2FA after registration.
 */
export const AppConfigSecondFactor = z.object({
  /**
   * Whether a second factor is required for password authentication.
   * If true, users must set up at least one 2FA method (TOTP or passkey).
   */
  required: z.boolean().default(false),
});

export type AppConfigSecondFactor = z.infer<typeof AppConfigSecondFactor>;

/**
 * Password authentication configuration (fixed type).
 */
export const AppConfigPasswordAuth = z.object({
  enabled: z.boolean().default(true),
  email_verification: z.boolean().default(true),
  /**
   * Second factor requirement configuration.
   * Controls whether users must set up 2FA after registration.
   */
  second_factor: AppConfigSecondFactor.default({
    required: false,
  }),
  totp: z
    .object({
      enabled: z.boolean().default(false),
      issuer: z.string().optional(),
    })
    .default({
      enabled: false,
    }),
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
    second_factor: {
      required: false,
    },
    totp: {
      enabled: false,
    },
  }),
  passkey: AppConfigPasskeyAuth.default({
    enabled: false,
    email_verification: true,
  }),
});

export type AppConfigBasicAuthenticationMethods = z.infer<
  typeof AppConfigBasicAuthenticationMethods
>;

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
 * Domain regex for WebAuthn rpId validation.
 * Allows:
 * - localhost (for development)
 * - Valid domain names (e.g., example.com, auth.example.com)
 * Rejects:
 * - URLs with protocol (http://, https://)
 * - Domains with port (:8080)
 */
const rpIdDomainRegex =
  /^(?!.*:\/\/)(?!.*:\d)(localhost|[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+)$/;

/**
 * Passkey (WebAuthn) authentication configuration (fixed type).
 */
export const AppConfigPasskeyAuth = z.object({
  enabled: z.boolean().default(false),
  email_verification: z.boolean().default(true),
  /**
   * WebAuthn Relying Party ID (domain only, no protocol or port).
   * Must be current domain or a registrable parent domain.
   * If not specified, extracted from app.host hostname.
   * Use parent domain to share passkeys across subdomains.
   * Example: "example.com" or "localhost"
   */
  rp_id: z
    .string()
    .regex(
      rpIdDomainRegex,
      'rp_id must be a valid domain without protocol or port ' +
        '(e.g., "example.com" or "localhost")',
    )
    .optional(),
  /**
   * Allowed origins for WebAuthn verification.
   * If not specified, uses app.host.
   * Example: ["https://auth.example.com", "https://app.example.com"]
   */
  origins: z.array(z.string().url()).optional(),
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

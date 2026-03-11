import z from 'zod';
import {
  PASSWORD_POLICY_MAX_LENGTH,
  PASSWORD_POLICY_MIN_LENGTH,
} from '#backend/lib/password-policy.js';

const SECOND_FACTOR_CONFIG_DEFAULT = {
  required: false,
};

/**
 * Second factor configuration for password authentication.
 * Determines if users must set up 2FA after registration.
 */
const SecondFactorConfigSchema = z
  .object({
    /**
     * Whether a second factor is required for password authentication.
     * If true, users must set up at least one 2FA method (TOTP or passkey).
     */
    required: z.boolean().default(SECOND_FACTOR_CONFIG_DEFAULT.required),
  })
  .default(SECOND_FACTOR_CONFIG_DEFAULT);

export type SecondFactorConfig = z.infer<typeof SecondFactorConfigSchema>;

export const PASSWORD_POLICY_CONFIG_DEFAULT = {
  min_length: PASSWORD_POLICY_MIN_LENGTH,
  max_length: PASSWORD_POLICY_MAX_LENGTH,
};

export const PasswordPolicyConfigSchema = z
  .object({
    min_length: z
      .number()
      .int()
      .min(1)
      .max(PASSWORD_POLICY_MAX_LENGTH)
      .default(PASSWORD_POLICY_CONFIG_DEFAULT.min_length),
    max_length: z
      .number()
      .int()
      .max(PASSWORD_POLICY_MAX_LENGTH)
      .default(PASSWORD_POLICY_CONFIG_DEFAULT.max_length),
  })
  .default(PASSWORD_POLICY_CONFIG_DEFAULT)
  .superRefine((value, ctx) => {
    if (value.min_length > value.max_length) {
      ctx.addIssue({
        code: 'custom',
        path: ['max_length'],
        message: 'max_length must be greater than or equal to min_length',
      });
    }
  });

export type PasswordPolicyConfig = z.infer<typeof PasswordPolicyConfigSchema>;

const PASSWORD_AUTH_TOTP_CONFIG_DEFAULT = {
  enabled: false,
  issuer: 'Tinyrack',
};

export const PASSWORD_AUTH_CONFIG_DEFAULT = {
  enabled: true,
  email_verification: true,
  second_factor: SECOND_FACTOR_CONFIG_DEFAULT,
  totp: PASSWORD_AUTH_TOTP_CONFIG_DEFAULT,
  policy: PASSWORD_POLICY_CONFIG_DEFAULT,
};

/**
 * Password authentication configuration (fixed type).
 */
export const PasswordAuthConfigSchema = z
  .object({
    enabled: z.boolean().default(PASSWORD_AUTH_CONFIG_DEFAULT.enabled),
    email_verification: z
      .boolean()
      .default(PASSWORD_AUTH_CONFIG_DEFAULT.email_verification),
    /**
     * Second factor requirement configuration.
     * Controls whether users must set up 2FA after registration.
     */
    second_factor: SecondFactorConfigSchema,
    totp: z
      .object({
        enabled: z
          .boolean()
          .default(PASSWORD_AUTH_TOTP_CONFIG_DEFAULT.enabled),
        issuer: z.string().default(PASSWORD_AUTH_TOTP_CONFIG_DEFAULT.issuer),
      })
      .default(PASSWORD_AUTH_TOTP_CONFIG_DEFAULT),
    policy: PasswordPolicyConfigSchema,
  })
  .default(PASSWORD_AUTH_CONFIG_DEFAULT);

export type PasswordAuthConfig = z.infer<typeof PasswordAuthConfigSchema>;

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

export const PASSKEY_AUTH_CONFIG_DEFAULT = {
  enabled: false,
  email_verification: true,
};

/**
 * Passkey (WebAuthn) authentication configuration (fixed type).
 */
export const PasskeyAuthConfigSchema = z
  .object({
    enabled: z.boolean().default(PASSKEY_AUTH_CONFIG_DEFAULT.enabled),
    email_verification: z
      .boolean()
      .default(PASSKEY_AUTH_CONFIG_DEFAULT.email_verification),
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
    origins: z.array(z.url()).optional(),
  })
  .default(PASSKEY_AUTH_CONFIG_DEFAULT);

export type PasskeyAuthConfig = z.infer<typeof PasskeyAuthConfigSchema>;

export const AUTH_CONFIG_DEFAULT = {
  password: PASSWORD_AUTH_CONFIG_DEFAULT,
  passkey: PASSKEY_AUTH_CONFIG_DEFAULT,
};

/**
 * Authentication methods configuration (fixed structure).
 * Contains password and passkey authentication settings.
 */
export const AuthConfigSchema = z
  .object({
    password: PasswordAuthConfigSchema,
    passkey: PasskeyAuthConfigSchema,
  })
  .default(AUTH_CONFIG_DEFAULT);

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

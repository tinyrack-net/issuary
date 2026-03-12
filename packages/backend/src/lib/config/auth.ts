import z from 'zod';
import {
  PASSWORD_POLICY_MAX_LENGTH,
  PASSWORD_POLICY_MIN_LENGTH,
} from '#backend/lib/password-policy.js';
import { zz } from '#backend/schemas/provider.js';

const PASSWORD_TWO_FACTOR_CONFIG_DEFAULT = {
  enrollment_required: false,
};

/**
 * Two-factor configuration for password authentication.
 * Determines if users must enroll a second factor after registration.
 */
const PasswordTwoFactorConfigSchema = z
  .object({
    /**
     * Whether password users must enroll a second factor.
     */
    enrollment_required: zz.COERCE_BOOLEAN.default(
      PASSWORD_TWO_FACTOR_CONFIG_DEFAULT.enrollment_required,
    ).describe(
      'Whether password users must enroll a second factor after registration.',
    ),
  })
  .strict()
  .default(PASSWORD_TWO_FACTOR_CONFIG_DEFAULT)
  .describe('Two-factor authentication enrollment settings.');

export type PasswordTwoFactorConfig = z.infer<
  typeof PasswordTwoFactorConfigSchema
>;

export const PASSWORD_POLICY_CONFIG_DEFAULT = {
  min_length: PASSWORD_POLICY_MIN_LENGTH,
  max_length: PASSWORD_POLICY_MAX_LENGTH,
};

export const PasswordPolicyConfigSchema = z
  .object({
    min_length: z.coerce
      .number()
      .int()
      .min(1)
      .max(PASSWORD_POLICY_MAX_LENGTH)
      .default(PASSWORD_POLICY_CONFIG_DEFAULT.min_length)
      .describe('Minimum password length.'),
    max_length: z.coerce
      .number()
      .int()
      .max(PASSWORD_POLICY_MAX_LENGTH)
      .default(PASSWORD_POLICY_CONFIG_DEFAULT.max_length)
      .describe('Maximum password length.'),
  })
  .default(PASSWORD_POLICY_CONFIG_DEFAULT)
  .describe('Password policy settings.')
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
  two_factor: PASSWORD_TWO_FACTOR_CONFIG_DEFAULT,
  totp: PASSWORD_AUTH_TOTP_CONFIG_DEFAULT,
  policy: PASSWORD_POLICY_CONFIG_DEFAULT,
};

/**
 * Password authentication configuration (fixed type).
 */
export const PasswordAuthConfigSchema = z
  .object({
    enabled: zz.COERCE_BOOLEAN.default(
      PASSWORD_AUTH_CONFIG_DEFAULT.enabled,
    ).describe('Whether password-based authentication is enabled.'),
    /**
     * Controls whether users must enroll a second factor after registration.
     */
    two_factor: PasswordTwoFactorConfigSchema,
    totp: z
      .object({
        enabled: zz.COERCE_BOOLEAN.default(
          PASSWORD_AUTH_TOTP_CONFIG_DEFAULT.enabled,
        ).describe('Whether TOTP-based two-factor authentication is enabled.'),
        issuer: z
          .string()
          .default(PASSWORD_AUTH_TOTP_CONFIG_DEFAULT.issuer)
          .describe(
            'Issuer name displayed in authenticator apps for TOTP enrollment.',
          ),
      })
      .strict()
      .default(PASSWORD_AUTH_TOTP_CONFIG_DEFAULT)
      .describe('TOTP (Time-based One-Time Password) configuration.'),
    policy: PasswordPolicyConfigSchema,
  })
  .strict()
  .default(PASSWORD_AUTH_CONFIG_DEFAULT)
  .describe('Password authentication configuration.');

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
};

/**
 * Passkey (WebAuthn) authentication configuration (fixed type).
 */
export const PasskeyAuthConfigSchema = z
  .object({
    enabled: zz.COERCE_BOOLEAN.default(
      PASSKEY_AUTH_CONFIG_DEFAULT.enabled,
    ).describe('Whether passkey (WebAuthn) authentication is enabled.'),
    /**
     * WebAuthn Relying Party ID (domain only, no protocol or port).
     * Must be current domain or a registrable parent domain.
     * If not specified, extracted from server.public_origin hostname.
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
     * If not specified, uses server.public_origin.
     * Example: ["https://auth.example.com", "https://app.example.com"]
     */
    origins: z.array(z.url()).optional(),
  })
  .strict()
  .default(PASSKEY_AUTH_CONFIG_DEFAULT)
  .describe('Passkey (WebAuthn) authentication configuration.');

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
    password: PasswordAuthConfigSchema.describe(
      'Password authentication settings.',
    ),
    passkey: PasskeyAuthConfigSchema.describe(
      'Passkey (WebAuthn) authentication settings.',
    ),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (
      val.password.two_factor.enrollment_required &&
      !val.password.totp.enabled &&
      !val.passkey.enabled
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'two_factor.enrollment_required is true but no 2FA method (totp or passkey) is enabled',
      });
    }
  })
  .default(AUTH_CONFIG_DEFAULT)
  .describe('Authentication methods configuration.');

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

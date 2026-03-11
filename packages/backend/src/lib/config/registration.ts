import z from 'zod';
import { zz } from '#backend/schemas/provider.js';

export const REGISTRATION_CONFIG_DEFAULT = {
  enabled: false,
  allowed_email_patterns: [] as string[],
  email_verification_required: true,
  signup_notice: {} as Record<string, string>,
} as const;

export const RegistrationConfigSchema = z
  .object({
    enabled: zz.COERCE_BOOLEAN.default(
      REGISTRATION_CONFIG_DEFAULT.enabled,
    ).describe('Whether self-registration is enabled.'),
    allowed_email_patterns: z
      .array(z.string())
      .default(REGISTRATION_CONFIG_DEFAULT.allowed_email_patterns)
      .describe(
        'Optional email filters for signup. When enabled is true and this list is empty, signup is unrestricted.',
      ),
    email_verification_required: zz.COERCE_BOOLEAN.default(
      REGISTRATION_CONFIG_DEFAULT.email_verification_required,
    ).describe(
      'Whether newly registered password users must verify email before full access.',
    ),
    signup_notice: z
      .record(z.string(), z.string())
      .default(REGISTRATION_CONFIG_DEFAULT.signup_notice)
      .describe(
        'Localized notice text for implicit consent terms during signup.',
      ),
  })
  .strict()
  .default(REGISTRATION_CONFIG_DEFAULT);

export type RegistrationConfig = z.infer<typeof RegistrationConfigSchema>;

import { e } from '../schemas/error.ts';

/** Configuration for password length constraints. */
export interface PasswordPolicy {
  min_length: number;
  max_length: number;
}

/** Default password policy enforcing a minimum of 12 and maximum of 256 characters. */
export const DEFAULT_PASSWORD_POLICY = {
  min_length: 12,
  max_length: 256,
} as const satisfies PasswordPolicy;

export const PASSWORD_POLICY_MIN_LENGTH = DEFAULT_PASSWORD_POLICY.min_length;
export const PASSWORD_POLICY_MAX_LENGTH = DEFAULT_PASSWORD_POLICY.max_length;

/**
 * Applies Unicode NFC normalization to a password so that visually identical
 * strings (e.g. precomposed vs decomposed characters) are treated equally.
 *
 * @param password - The raw password string.
 * @returns The NFC-normalized password.
 */
export function normalizePassword(password: string): string {
  return password.normalize('NFC');
}

/**
 * Validates a password against the given policy and returns a human-readable
 * error message if the password violates any constraint.
 *
 * @param password - The raw password to validate.
 * @param policy - The password policy to check against. Defaults to {@link DEFAULT_PASSWORD_POLICY}.
 * @returns An error message string if validation fails, or `null` if the password is valid.
 */
export function getPasswordPolicyError(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): string | null {
  const normalized = normalizePassword(password);

  if (normalized.length < policy.min_length) {
    return `Password must be at least ${policy.min_length} characters long.`;
  }

  if (normalized.length > policy.max_length) {
    return `Password must be at most ${policy.max_length} characters long.`;
  }

  return null;
}

/**
 * Validates a password against the given policy and throws a
 * {@link e.ValidationError.Error} if it does not meet the requirements.
 *
 * @param password - The raw password to validate.
 * @param policy - The password policy to check against. Defaults to {@link DEFAULT_PASSWORD_POLICY}.
 * @throws {e.ValidationError.Error} If the password violates the policy.
 */
export function assertPasswordPolicy(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): void {
  const error = getPasswordPolicyError(password, policy);
  if (error) {
    throw new e.ValidationError.Error(error);
  }
}

import { authenticator } from 'otplib';

/**
 * Generate a TOTP code from a secret
 */
export function generateTOTPCode(secret: string): string {
  return authenticator.generate(secret);
}

/**
 * Extract secret from otpauth URL
 * Format: otpauth://totp/LABEL?secret=SECRET&issuer=ISSUER
 */
export function extractSecretFromOtpauthUrl(otpauthUrl: string): string {
  const url = new URL(otpauthUrl);
  const secret = url.searchParams.get('secret');
  if (!secret) {
    throw new Error('Secret not found in otpauth URL');
  }
  return secret;
}

/**
 * Verify that a TOTP code is valid for a given secret
 */
export function verifyTOTPCode(secret: string, code: string): boolean {
  return authenticator.verify({ token: code, secret });
}

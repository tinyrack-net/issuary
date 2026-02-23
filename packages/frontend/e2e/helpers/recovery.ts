/**
 * Selectors for the TOTP recovery code verification page
 * (/verify/totp/recovery).
 */
export const recoveryPage = {
  /** Recovery code text input */
  codeInput: '[data-testid="recovery-code-input"]',
  /** Submit button */
  submitButton: 'button[type="submit"]',
  /** Field error text */
  fieldError: '[data-testid="recovery-error"]',
  /** Session expired warning alert */
  sessionExpiredAlert: '[data-testid="recovery-session-expired"]',
  /** "Back to authenticator" link */
  backToTotpLink: '[data-testid="recovery-back-to-totp"]',
} as const;

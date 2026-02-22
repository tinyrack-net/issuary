/**
 * Selectors for the TOTP recovery code verification page
 * (/verify/totp/recovery).
 */
export const recoveryPage = {
  /** Recovery code text input */
  codeInput: 'input[autocomplete="off"]',
  /** Submit button */
  submitButton: 'button[type="submit"]',
  /** Field error text */
  fieldError: '.text-error',
  /** Session expired warning alert */
  sessionExpiredAlert: '.alert-warning',
  /** "Back to authenticator" link */
  backToTotpLink: 'button.link.link-info',
} as const;

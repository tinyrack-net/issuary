import { IssuaryError } from './error.ts';

export type PasskeyErrorReason =
  | 'unsupported'
  | 'not_allowed'
  | 'expired'
  | 'user_mismatch'
  | 'verification_failed';

const UNSUPPORTED_ERROR_NAMES = new Set(['NotSupportedError', 'SecurityError']);

const NOT_ALLOWED_ERROR_NAMES = new Set([
  'AbortError',
  'NotAllowedError',
  'InvalidStateError',
]);

const VERIFICATION_FAILED_CODES = new Set([
  'PASSKEY_CHALLENGE_EXPIRED',
  'PASSKEY_CHALLENGE_NOT_FOUND',
  'PASSKEY_NOT_FOUND',
  'PASSKEY_NOT_ENABLED',
  'PASSKEY_VERIFICATION_FAILED',
  'UNKNOWN_ERROR',
]);

function browserCannotUsePasskeys(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  if (window.isSecureContext === false) {
    return true;
  }

  return !('PublicKeyCredential' in window);
}

function errorName(error: unknown): string | null {
  if (error instanceof Error) {
    return error.name;
  }

  return null;
}

export function classifyPasskeyError(error: unknown): PasskeyErrorReason {
  if (error instanceof IssuaryError) {
    if (error.code === 'SECOND_FACTOR_SESSION_EXPIRED') {
      return 'expired';
    }

    if (error.code === 'PASSKEY_USER_MISMATCH') {
      return 'user_mismatch';
    }

    if (VERIFICATION_FAILED_CODES.has(error.code)) {
      return 'verification_failed';
    }
  }

  const name = errorName(error);
  if (name && UNSUPPORTED_ERROR_NAMES.has(name)) {
    return 'unsupported';
  }

  if (name && NOT_ALLOWED_ERROR_NAMES.has(name)) {
    return 'not_allowed';
  }

  if (browserCannotUsePasskeys()) {
    return 'unsupported';
  }

  return 'verification_failed';
}

import type { TFunction } from 'i18next';
import { IssuaryError } from './error.js';

export function securityErrorMessage(
  error: unknown,
  t: TFunction,
  fallback: string,
): string {
  if (error instanceof IssuaryError) {
    if (error.code === 'UNAUTHORIZED') return t('error.authenticationRevoked');
    if (error.code === 'CONCURRENT_SECURITY_CHANGE')
      return t('error.concurrentSecurityChange');
    if (error.code === 'TOO_MANY_REQUESTS') return t('error.tooManyRequests');
    if (error.code === 'REQUEST_BODY_TOO_LARGE')
      return t('error.requestBodyTooLarge');
  }
  return fallback;
}

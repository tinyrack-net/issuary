import i18n from '@/i18n/index.js';
import { ApiError } from './error';

/**
 * Convert HeadersInit to a plain object
 */
const headersToRecord = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return { ...headers };
};

/**
 * Enhanced fetch wrapper
 *
 * - Automatically sets JSON Content-Type header
 * - Automatically sets Accept-Language header from i18n
 * - Converts error responses to ApiError
 *
 * @throws {ApiError} On HTTP error response
 */
export const etch = async (url: string, options?: RequestInit) => {
  const headers = headersToRecord(options?.headers);

  // Only set Content-Type: application/json when there's a body to send
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  // Set Accept-Language header from i18n current language
  if (!headers['Accept-Language']) {
    headers['Accept-Language'] = i18n.language;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }

  return res;
};

import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Registers a new user via the backend API using Playwright's
 * APIRequestContext, which automatically manages cookies.
 *
 * @param request - Playwright APIRequestContext
 * @param baseURL - Backend base URL (e.g. http://localhost:18081)
 * @param email - User email
 * @param password - User password
 * @returns The Playwright API response
 */
export async function registerUser(
  request: APIRequestContext,
  baseURL: string,
  email: string,
  password: string,
): Promise<APIResponse> {
  return request.post(`${baseURL}/api/auth/register`, {
    data: { email, password },
  });
}

import { getTestApiClient } from '#frontend-e2e/setup/api-client.js';

/**
 * Fetches the email verification token for a user via the test endpoint.
 */
export async function getEmailToken(
  baseURL: string,
  email: string,
): Promise<string> {
  const client = getTestApiClient({ baseUrl: baseURL });
  const res = await client.test['email-token'][':email'].$get({
    param: { email },
  });
  if (!res.ok) {
    throw new Error(`Failed to get email token: ${res.status}`);
  }
  const data = await res.json();
  return data.token;
}

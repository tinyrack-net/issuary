import { randomUUID } from 'node:crypto';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

export type RegisterUserInput = {
  email: string;
  password: string;
  consents?: Array<{
    termsId: string;
    agreed: boolean;
  }>;
};

/**
 * Generates a unique test email.
 */
export function createUniqueEmail(
  prefix: string,
  domain = 'example.com',
): string {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  return `${prefix}-${suffix}@${domain}`;
}

/**
 * Registers a user through the public API and throws when it fails.
 */
export async function registerUserViaApi(
  baseURL: string,
  input: RegisterUserInput,
): Promise<void> {
  const client = getTestApiClient({ baseUrl: baseURL });
  const registerRes = await client.api.auth.register.$post({
    header: {},
    json: {
      email: input.email,
      password: input.password,
      ...(input.consents ? { consents: input.consents } : {}),
    },
  });

  if (!registerRes.ok) {
    throw new Error(`Failed to register user: ${registerRes.status}`);
  }
}

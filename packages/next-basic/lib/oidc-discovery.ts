import type { OpenIDConfiguration } from '@/types/oidc';

/**
 * Fetch OpenID Provider Configuration using OIDC Discovery
 * https://openid.net/specs/openid-connect-discovery-1_0.html
 *
 * @param issuer - The issuer URL (e.g., 'http://localhost:8080')
 * @returns OpenID Provider Configuration
 * @throws Error if discovery fails
 */
export async function fetchOpenIDConfiguration(
  issuer: string,
): Promise<OpenIDConfiguration> {
  // Normalize issuer URL (remove trailing slash)
  const normalizedIssuer = issuer.replace(/\/$/, '');

  // Build discovery URL
  const discoveryUrl = `${normalizedIssuer}/.well-known/openid-configuration`;

  try {
    const response = await fetch(discoveryUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `OpenID Discovery failed: ${response.status} ${response.statusText}`,
      );
    }

    const config = (await response.json()) as OpenIDConfiguration;

    // Validate required fields
    if (!config.issuer || !config.authorization_endpoint) {
      throw new Error('Invalid OpenID Configuration: missing required fields');
    }

    // Verify issuer matches
    if (config.issuer !== normalizedIssuer) {
      console.warn(
        `Issuer mismatch: expected ${normalizedIssuer}, got ${config.issuer}`,
      );
    }

    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch OpenID Configuration: ${error.message}`);
    }
    throw new Error('Failed to fetch OpenID Configuration: Unknown error');
  }
}

/**
 * Fetch OpenID Configuration with retry logic
 * Useful in development when backend might start later
 *
 * @param issuer - The issuer URL
 * @param options - Retry options
 * @returns OpenID Provider Configuration
 */
export async function fetchOpenIDConfigurationWithRetry(
  issuer: string,
  options: {
    maxRetries?: number;
    retryDelay?: number;
  } = {},
): Promise<OpenIDConfiguration> {
  const { maxRetries = 3, retryDelay = 1000 } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchOpenIDConfiguration(issuer);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        console.warn(
          `OpenID Discovery attempt ${attempt + 1} failed, retrying in ${retryDelay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw lastError || new Error('Failed to fetch OpenID Configuration');
}

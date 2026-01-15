import type { OIDCConfig, OpenIDConfiguration } from '@/types/oidc';
import { loadEnvConfig } from './env';
import {
  fetchOpenIDConfiguration,
  fetchOpenIDConfigurationWithRetry,
} from './oidc-discovery';

/**
 * Runtime OIDC configuration
 * Initialized via initializeOIDCConfig()
 */
let oidcConfig: OIDCConfig | null = null;

/**
 * Merge OpenID Configuration with client credentials
 */
function mergeConfig(
  discovery: OpenIDConfiguration,
  client: {
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    scope: string;
  },
): OIDCConfig {
  return {
    issuer: discovery.issuer,
    authorization_endpoint: discovery.authorization_endpoint,
    token_endpoint: discovery.token_endpoint,
    userinfo_endpoint: discovery.userinfo_endpoint || '',
    introspection_endpoint: discovery.introspection_endpoint || '',
    revocation_endpoint: discovery.revocation_endpoint || '',
    jwks_uri: discovery.jwks_uri,
    openid_configuration_uri: `${discovery.issuer}/.well-known/openid-configuration`,

    client_id: client.client_id,
    client_secret: client.client_secret,
    redirect_uri: client.redirect_uri,

    scope: client.scope,
    response_type: 'code',
  };
}

/**
 * Initialize OIDC configuration using OpenID Discovery
 *
 * @param options - Configuration options (optional, uses env vars by default)
 * @returns Promise<OIDCConfig>
 */
export async function initializeOIDCConfig(options?: {
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scope?: string;
  useRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}): Promise<OIDCConfig> {
  // Load environment configuration
  const envConfig = loadEnvConfig();

  const issuer = options?.issuer || envConfig.issuer;
  const clientId = options?.clientId || envConfig.clientId;
  const clientSecret = options?.clientSecret || envConfig.clientSecret;
  const redirectUri = options?.redirectUri || envConfig.redirectUri;
  const scope = options?.scope || envConfig.scope;

  const useRetry = options?.useRetry ?? envConfig.discovery.retryEnabled;
  const maxRetries = options?.maxRetries ?? envConfig.discovery.maxRetries;
  const retryDelay = options?.retryDelay ?? envConfig.discovery.retryDelayMs;

  try {
    console.log(`Fetching OpenID Configuration from: ${issuer}`);

    const discovery = useRetry
      ? await fetchOpenIDConfigurationWithRetry(issuer, {
          maxRetries,
          retryDelay,
        })
      : await fetchOpenIDConfiguration(issuer);

    oidcConfig = mergeConfig(discovery, {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      scope,
    });

    console.log('✓ OpenID Configuration loaded successfully');
    return oidcConfig;
  } catch (error) {
    console.error('Failed to fetch OpenID Configuration:', error);
    throw error;
  }
}

/**
 * Get current OIDC configuration
 * Throws error if not initialized
 */
export function getOIDCConfig(): OIDCConfig {
  if (!oidcConfig) {
    throw new Error(
      'OIDC config not initialized. Call initializeOIDCConfig() first.',
    );
  }
  return oidcConfig;
}

/**
 * Check if OIDC configuration is initialized
 */
export function isOIDCConfigInitialized(): boolean {
  return oidcConfig !== null;
}

/**
 * Export for backward compatibility
 * @deprecated Use getOIDCConfig() instead
 */
export { getOIDCConfig as oidcConfig };

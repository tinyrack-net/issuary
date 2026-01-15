/**
 * Environment variables configuration
 */
export interface EnvConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  discovery: {
    retryEnabled: boolean;
    maxRetries: number;
    retryDelayMs: number;
  };
}

/**
 * Get environment variable or throw error if not found
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get boolean environment variable
 */
function getBooleanEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value === 'true' || value === '1';
}

/**
 * Get number environment variable
 */
function getNumberEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) {
    console.warn(
      `Invalid number for ${key}: ${value}, using default: ${defaultValue}`,
    );
    return defaultValue;
  }
  return num;
}

/**
 * Load and validate environment configuration
 */
export function loadEnvConfig(): EnvConfig {
  return {
    issuer: getEnvVar('OIDC_ISSUER', 'http://localhost:8080'),
    clientId: getEnvVar('OIDC_CLIENT_ID', 'sdlk3n3dkj2'),
    clientSecret: getEnvVar('OIDC_CLIENT_SECRET', 'sdlk3n3dkj2'),
    redirectUri: getEnvVar(
      'OIDC_REDIRECT_URI',
      'http://localhost:3000/api/callback',
    ),
    scope: getEnvVar('OIDC_SCOPE', 'openid profile email'),
    discovery: {
      retryEnabled: getBooleanEnv('OIDC_DISCOVERY_RETRY_ENABLED', true),
      maxRetries: getNumberEnv('OIDC_DISCOVERY_MAX_RETRIES', 3),
      retryDelayMs: getNumberEnv('OIDC_DISCOVERY_RETRY_DELAY_MS', 1000),
    },
  };
}

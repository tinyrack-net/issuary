/**
 * Swagger/OpenAPI tag constants for route documentation
 *
 * Use these constants in route schema definitions for consistent tagging.
 */
export const TAGS = {
  ADMIN: 'Admin',
  AUTH: 'Auth',
  USER: 'User',
  CONSENT: 'Consent',
  TERMS: 'Terms',
  OAUTH_CONNECT: 'OAuth Connect',
  OPENID: 'OpenID',
  HEALTH: 'Health',
} as const;

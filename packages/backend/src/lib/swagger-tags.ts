/**
 * Swagger/OpenAPI tag constants for route documentation
 *
 * Use these constants in route schema definitions for consistent tagging.
 */
export const TAGS = {
  AUTH: 'Auth',
  USER: 'User',
  CONSENT: 'Consent',
  TERMS: 'Terms',
  OAUTH_CONNECT: 'OAuth Connect',
  OPENID: 'OpenID',
  HEALTH: 'Health',
} as const;

export type SwaggerTag = (typeof TAGS)[keyof typeof TAGS];

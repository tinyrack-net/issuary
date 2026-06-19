/**
 * Test fixtures and constants used across all test files.
 * Provides reusable test data for OAuth clients, users, and PKCE.
 */

/**
 * OAuth client configuration for testing.
 * To use in tests, include TEST_OAUTH_CLIENT_CONFIG in your server config's providers array.
 */
export const TEST_OAUTH_CLIENT = {
  clientId: 'sdlk3n3dkj2',
  clientSecret: 'sdlk3n3dkj2-secret',
  redirectUri: 'http://localhost:8080/callback',
  allowedScopes: ['openid', 'profile', 'email'],
} as const;

/**
 * Config snippet for TEST_OAUTH_CLIENT.
 * Spread this into your server config's providers array.
 */
export const TEST_OAUTH_CLIENT_CONFIG = {
  id: 'test-config-oauth-client',
  name: 'My App',
  logo_uri: 'https://myapp.com/auth/callback',
  client_id: TEST_OAUTH_CLIENT.clientId,
  client_secret: TEST_OAUTH_CLIENT.clientSecret,
  redirect_uris: [TEST_OAUTH_CLIENT.redirectUri],
  response_types: ['code'],
  grant_types: ['authorization_code'],
  scope: 'openid profile email id_token',
};

/**
 * Test user credentials.
 * To use in tests, include TEST_USER_CONFIG in your server config's users array.
 */
export const TEST_USER = {
  email: 'test-config-user@example.com',
  password: 'changemelater',
} as const;

/**
 * Config snippet for TEST_USER.
 * Spread this into your server config's users array.
 */
export const TEST_USER_CONFIG = {
  sub: 'test-config-user',
  email: TEST_USER.email,
  password: TEST_USER.password,
  role: 'admin',
} as const;

/**
 * PKCE test vectors (RFC 7636 compliant)
 * code_verifier: dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
 * code_challenge (S256): E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
 */
export const TEST_PKCE = {
  codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  codeChallengeMethod: 'S256' as const,
  codeVerifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
} as const;

/**
 * Default OAuth scopes for testing
 */
export const DEFAULT_SCOPES = 'openid profile email';

/**
 * Test terms configuration.
 * Include these in your server config's terms array when testing terms/consent flows.
 */
export const TEST_TERMS_CONFIG = [
  {
    id: 'tos',
    required: true,
    consent_mode: 'explicit' as const,
    version: '1.0.0',
    content: {
      ko: {
        title: '이용약관',
        type: 'link' as const,
        content: 'https://example.com/terms/ko',
      },
      en: {
        title: 'Terms of Service',
        type: 'link' as const,
        content: 'https://example.com/terms/en',
      },
    },
  },
  {
    id: 'privacy',
    required: true,
    consent_mode: 'explicit' as const,
    version: '1.0.0',
    content: {
      ko: {
        title: '개인정보처리방침',
        type: 'link' as const,
        content: 'https://example.com/privacy/ko',
      },
      en: {
        title: 'Privacy Policy',
        type: 'link' as const,
        content: 'https://example.com/privacy/en',
      },
    },
  },
];

/**
 * Default terms consents for registration tests.
 * Matches the terms defined in TEST_TERMS_CONFIG.
 */
export const TEST_CONSENTS = [
  { termsId: 'tos', agreed: true },
  { termsId: 'privacy', agreed: true },
] as const;

/**
 * Generate unique email for testing
 */
export function generateUniqueEmail(prefix = 'test'): string {
  return `${prefix}${Date.now()}@example.com`;
}

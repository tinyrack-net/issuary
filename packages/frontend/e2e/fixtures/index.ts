/**
 * Test user credentials for e2e tests.
 */
export const E2E_TEST_USER = {
  email: 'e2e-test-user@example.com',
  password: 'changemelater',
} as const;

/**
 * Config-based test user definition.
 */
export const E2E_TEST_USER_CONFIG = {
  sub: 'e2e-test-user',
  email: E2E_TEST_USER.email,
  password: E2E_TEST_USER.password,
  role: 'admin',
} as const;

/**
 * Test OAuth client credentials for e2e tests.
 */
export const E2E_TEST_CLIENT = {
  clientId: 'e2e-test-client-id',
  clientSecret: 'e2e-test-client-secret',
  redirectUri: 'http://localhost:18080/callback',
} as const;

/**
 * Config-based test OAuth client definition.
 */
export const E2E_TEST_CLIENT_CONFIG = {
  id: 'e2e-test-oauth-client',
  name: 'E2E Test App',
  client_id: E2E_TEST_CLIENT.clientId,
  client_secret: E2E_TEST_CLIENT.clientSecret,
  redirect_uris: [E2E_TEST_CLIENT.redirectUri],
  response_types: ['code'],
  grant_types: ['authorization_code'],
  scope: 'openid profile email',
};

export const E2E_TEST_SECURITY_CONFIG = {
  hash_master_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
  pbkdf2_iterations: 1000,
} as const;

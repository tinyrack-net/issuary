import { expect, test } from '@playwright/test';
import { uniqueEmail, uniqueTestId } from '#frontend-e2e/helpers/identity.ts';

test.describe('unique E2E identity helper', () => {
  test('builds retry and worker scoped ids without collisions', () => {
    const testInfo = test.info();
    const firstId = uniqueTestId(testInfo, 'OAuth Client Login');
    const secondId = uniqueTestId(testInfo, 'OAuth Client Login');

    expect(firstId).toMatch(/^oauth-client-login-w\d+-r\d+-[a-z0-9]+$/);
    expect(secondId).toMatch(/^oauth-client-login-w\d+-r\d+-[a-z0-9]+$/);
    expect(secondId).not.toBe(firstId);
  });

  test('builds safe unique emails for test users', () => {
    const testInfo = test.info();
    const email = uniqueEmail(testInfo, 'Register Minimal Success');

    expect(email).toMatch(
      /^register-minimal-success-w\d+-r\d+-[a-z0-9]+@example\.com$/,
    );
  });
});

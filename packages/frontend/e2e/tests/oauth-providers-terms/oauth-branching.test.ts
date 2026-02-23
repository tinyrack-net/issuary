import { expect, test } from '@frontend-e2e/fixtures/oauth-providers-terms.js';
import { startOAuthLogin } from '@frontend-e2e/helpers/oauth.js';
import { registerPage } from '@frontend-e2e/helpers/register-page.js';
import { getTestApiClient } from '@frontend-e2e/setup/api-client.js';
import { z } from 'zod';

const TEST_PASSWORD = 'test-password-123';
const EXISTING_COMPLETE_EMAIL = 'oauth-stub-existing-complete@allowed.test';

const consentPayloadSchema = z.object({
  consents: z.array(
    z.object({
      termsId: z.string(),
      agreed: z.boolean(),
      consentType: z.enum(['explicit', 'implicit']).optional(),
    }),
  ),
  registrationToken: z.string().uuid().optional(),
});

async function registerUserWithTerms(
  baseURL: string,
  email: string,
): Promise<void> {
  const client = getTestApiClient({ baseUrl: baseURL });
  const registerRes = await client.api.auth.register.$post({
    header: {},
    json: {
      email,
      password: TEST_PASSWORD,
      consents: [
        { termsId: 'tos', agreed: true },
        { termsId: 'privacy', agreed: true },
      ],
    },
  });

  if (!registerRes.ok) {
    throw new Error(`Failed to register user: ${registerRes.status}`);
  }
}

test.describe('OAuth branching with explicit and implicit terms', () => {
  test('new OAuth user completes registration through terms flow', async ({
    page,
  }) => {
    await page.goto('/login');
    await startOAuthLogin(page, 'Stub New User');

    await page.waitForURL('**/terms**');
    const termsUrl = new URL(page.url());
    expect(termsUrl.pathname).toBe('/terms');
    expect(termsUrl.searchParams.get('mode')).toBe('complete_registration');
    expect(termsUrl.searchParams.get('registration_token')).toBeTruthy();

    const consentRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        request.url().includes('/api/terms/consent'),
    );

    // First checkbox is "Agree all", second is required TOS term.
    await page.locator(registerPage.termsCheckbox).nth(1).check();
    await page.locator('button[type="submit"]').click();

    const consentRequest = await consentRequestPromise;
    const body = consentRequest.postData();
    if (!body) {
      throw new Error('Expected terms consent request body');
    }

    const payload = consentPayloadSchema.parse(JSON.parse(body));
    expect(payload.registrationToken).toBeTruthy();
    expect(payload.consents).toEqual(
      expect.arrayContaining([
        { termsId: 'tos', agreed: true, consentType: 'explicit' },
        { termsId: 'privacy', agreed: false, consentType: 'explicit' },
        { termsId: 'analytics', agreed: true, consentType: 'implicit' },
      ]),
    );

    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('existing OAuth user with pending required terms is redirected to /terms', async ({
    page,
  }) => {
    await page.goto('/login');
    await startOAuthLogin(page, 'Stub Existing Pending');

    await page.waitForURL('**/terms**');
    const termsUrl = new URL(page.url());
    expect(termsUrl.pathname).toBe('/terms');
    expect(termsUrl.searchParams.get('mode')).toBeNull();
    expect(termsUrl.searchParams.get('registration_token')).toBeNull();

    await page.locator(registerPage.termsCheckbox).nth(1).check();
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('existing OAuth user with completed terms logs in directly', async ({
    page,
    baseURL,
  }) => {
    await registerUserWithTerms(String(baseURL), EXISTING_COMPLETE_EMAIL);

    await page.goto('/login');
    await startOAuthLogin(page, 'Stub Existing Complete');

    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByText(EXISTING_COMPLETE_EMAIL).first()).toBeVisible();
  });
});

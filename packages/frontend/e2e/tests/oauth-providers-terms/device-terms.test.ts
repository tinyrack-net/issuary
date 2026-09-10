import { expect } from '@playwright/test';
import { z } from 'zod';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_CLIENT,
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { registerPage } from '#frontend-e2e/helpers/register-page.ts';

const test = createScenarioFixture((port) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(port),
  users: [E2E_TEST_USER_CONFIG],
  clients: [
    {
      ...E2E_TEST_CLIENT_CONFIG,
      grant_types: [
        'authorization_code',
        'urn:ietf:params:oauth:grant-type:device_code',
      ],
    },
  ],
  terms: [
    {
      id: 'device-terms',
      required: true,
      consent_mode: 'explicit',
      version: '1',
      content: {
        en: {
          title: 'Device terms',
          type: 'text',
          content: 'Required device terms.',
        },
      },
    },
  ],
}));

test('required terms return to the same device and require a separate approval', async ({
  page,
  serverPort,
}) => {
  const origin = `http://localhost:${serverPort}`;
  expect(
    (
      await page.request.post(`${origin}/api/auth/login`, {
        data: E2E_TEST_USER,
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(200);
  const issued = await page.request.post(
    `${origin}/oauth/device_authorization`,
    {
      form: {
        client_id: E2E_TEST_CLIENT.clientId,
        client_secret: E2E_TEST_CLIENT.clientSecret,
        scope: 'openid email',
      },
    },
  );
  expect(issued.status()).toBe(200);
  const device = z
    .object({ device_code: z.string(), user_code: z.string() })
    .parse(await issued.json());
  const direct = await page.request.post(`${origin}/oauth/device`, {
    form: { user_code: device.user_code },
    headers: { Origin: origin },
    maxRedirects: 0,
  });
  expect(direct.status()).toBe(303);
  await page.goto(
    `${origin}/oauth/device?${new URLSearchParams({ user_code: device.user_code })}`,
  );
  await expect(page).toHaveURL(/\/terms\?/);
  await page.locator(registerPage.termsCheckbox).check();
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(
    new RegExp(`/oauth/device\\?user_code=${device.user_code}$`),
  );
  await expect(
    page.getByRole('heading', { name: 'E2E Test App' }),
  ).toBeVisible();
  const exchange = () =>
    page.request.post(`${origin}/oauth/token`, {
      form: {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: E2E_TEST_CLIENT.clientId,
        client_secret: E2E_TEST_CLIENT.clientSecret,
        device_code: device.device_code,
      },
    });
  const pending = await exchange();
  expect(pending.status()).toBe(400);
  expect(await pending.json()).toMatchObject({
    error: 'authorization_pending',
  });
  const approved = page.waitForResponse(
    (response) =>
      response.url() === `${origin}/oauth/device` &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  expect((await approved).status()).toBe(200);
  const tokenResponse = await exchange();
  expect(tokenResponse.status()).toBe(200);
  const tokens = z
    .object({ access_token: z.string() })
    .parse(await tokenResponse.json());
  expect(
    (
      await page.request.get(`${origin}/oauth/userinfo`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
    ).status(),
  ).toBe(200);
});

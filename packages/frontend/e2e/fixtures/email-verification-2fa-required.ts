import { createEmailVerification2faRequiredConfig } from '#frontend-e2e/configs/email-verification-2fa-required.js';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(
  createEmailVerification2faRequiredConfig,
);
export { expect } from '@playwright/test';

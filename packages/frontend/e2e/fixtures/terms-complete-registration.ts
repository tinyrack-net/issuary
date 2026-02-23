import { createTermsCompleteRegistrationConfig } from '@frontend-e2e/configs/terms-complete-registration.js';
import { createScenarioFixture } from '@frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(
  createTermsCompleteRegistrationConfig,
);
export { expect } from '@playwright/test';

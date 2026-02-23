import { createEmailVerificationConfig } from '@frontend-e2e/configs/email-verification.js';
import { createScenarioFixture } from '@frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createEmailVerificationConfig);
export { expect } from '@playwright/test';

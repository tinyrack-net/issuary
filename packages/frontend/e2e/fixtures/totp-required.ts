import { createTotpRequiredConfig } from '#frontend-e2e/configs/totp-required.js';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createTotpRequiredConfig);
export { expect } from '@playwright/test';

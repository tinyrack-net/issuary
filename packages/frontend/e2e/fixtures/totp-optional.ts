import { createTotpOptionalConfig } from '#frontend-e2e/configs/totp-optional.js';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createTotpOptionalConfig);
export { expect } from '@playwright/test';

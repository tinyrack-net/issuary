import { createPasskeyRequiredConfig } from '@frontend-e2e/configs/passkey-required.js';
import { createScenarioFixture } from '@frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createPasskeyRequiredConfig);
export { expect } from '@playwright/test';

import { createPasskeyOptionalConfig } from '@frontend-e2e/configs/passkey-optional.js';
import { createScenarioFixture } from '@frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createPasskeyOptionalConfig);
export { expect } from '@playwright/test';

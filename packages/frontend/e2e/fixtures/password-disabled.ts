import { createPasswordDisabledConfig } from '@frontend-e2e/configs/password-disabled.js';
import { createScenarioFixture } from '@frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createPasswordDisabledConfig);
export { expect } from '@playwright/test';

import { createRegistrationDisabledConfig } from '@frontend-e2e/configs/registration-disabled.js';
import { createScenarioFixture } from '@frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createRegistrationDisabledConfig);
export { expect } from '@playwright/test';

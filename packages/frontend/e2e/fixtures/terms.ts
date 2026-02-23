import { createTermsConfig } from '@frontend-e2e/configs/terms.js';
import { createScenarioFixture } from '@frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createTermsConfig);
export { expect } from '@playwright/test';

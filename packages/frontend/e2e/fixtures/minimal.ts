import { createMinimalConfig } from '@frontend-e2e/configs/minimal.js';
import { createScenarioFixture } from '@frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createMinimalConfig);
export { expect } from '@playwright/test';

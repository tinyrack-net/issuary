import { createConfigManagedProfileConfig } from '#frontend-e2e/configs/config-managed-profile.js';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createConfigManagedProfileConfig);
export { expect } from '@playwright/test';

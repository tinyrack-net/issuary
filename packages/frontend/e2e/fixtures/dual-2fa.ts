import { createDual2faConfig } from '#frontend-e2e/configs/dual-2fa.js';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createDual2faConfig);
export { expect } from '@playwright/test';

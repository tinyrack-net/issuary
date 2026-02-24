import { createAccountDeletionConfig } from '#frontend-e2e/configs/account-deletion.js';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createAccountDeletionConfig);
export { expect } from '@playwright/test';

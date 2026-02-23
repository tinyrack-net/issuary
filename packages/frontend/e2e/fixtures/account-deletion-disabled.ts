import { createAccountDeletionDisabledConfig } from '@frontend-e2e/configs/account-deletion-disabled.js';
import { createScenarioFixture } from '@frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createAccountDeletionDisabledConfig);
export { expect } from '@playwright/test';

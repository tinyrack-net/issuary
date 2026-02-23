import { createOauthProvidersMixedConfig } from '@frontend-e2e/configs/oauth-providers-mixed.js';
import { createScenarioFixture } from '@frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createOauthProvidersMixedConfig);
export { expect } from '@playwright/test';

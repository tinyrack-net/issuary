import { createOauthProvidersConfig } from '#frontend-e2e/configs/oauth-providers.js';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createOauthProvidersConfig);
export { expect } from '@playwright/test';

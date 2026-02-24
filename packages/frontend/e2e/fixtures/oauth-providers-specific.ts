import { createOauthProvidersSpecificConfig } from '#frontend-e2e/configs/oauth-providers-specific.js';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createOauthProvidersSpecificConfig);
export { expect } from '@playwright/test';

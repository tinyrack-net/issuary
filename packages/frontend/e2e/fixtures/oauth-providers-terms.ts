import { createOauthProvidersTermsConfig } from '@frontend-e2e/configs/oauth-providers-terms.js';
import { createScenarioFixture } from '@frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createOauthProvidersTermsConfig);
export { expect } from '@playwright/test';

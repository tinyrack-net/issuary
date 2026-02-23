import { createJourneyOauth2faConfig } from '@frontend-e2e/configs/journey-oauth-2fa.js';
import { createScenarioFixture } from '@frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createJourneyOauth2faConfig);
export { expect } from '@playwright/test';

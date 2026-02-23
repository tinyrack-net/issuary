import { createThemeDarkFixedConfig } from '@frontend-e2e/configs/theme-dark-fixed.js';
import { createScenarioFixture } from '@frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createThemeDarkFixedConfig);
export { expect } from '@playwright/test';

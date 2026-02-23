import { createThemeSystemMultilangConfig } from '@frontend-e2e/configs/theme-system-multilang.js';
import { createScenarioFixture } from '@frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createThemeSystemMultilangConfig);
export { expect } from '@playwright/test';

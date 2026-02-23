import { createUiBrandingLocaleThemeConfig } from '@frontend-e2e/configs/ui-branding-locale-theme.js';
import { createScenarioFixture } from '@frontend-e2e/fixtures/create-scenario-fixture.js';

export const test = createScenarioFixture(createUiBrandingLocaleThemeConfig);
export { expect } from '@playwright/test';

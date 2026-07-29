import { expect, test } from 'vitest';
import { getTermsQueryOptions } from '#frontend/queries/terms.ts';
import {
  appConfigQueryData,
  renderRoute,
} from '#frontend/test-utils/route-test-utils.tsx';
import { screenScenarioDefinitions } from '#frontend/test-utils/screen-scenario-catalog.ts';

const routeScenarios = screenScenarioDefinitions.filter(
  (scenario) => scenario.runtime === 'route',
);

test('declares unique scenario and variant IDs', () => {
  const scenarioIds = screenScenarioDefinitions.map((scenario) => scenario.id);
  expect(new Set(scenarioIds).size).toBe(scenarioIds.length);

  for (const scenario of screenScenarioDefinitions) {
    const variantIds = scenario.variants.map((variant) => variant.id);
    expect(new Set(variantIds).size).toBe(variantIds.length);
  }
});

for (const scenario of routeScenarios) {
  test(`renders the ${scenario.id} Screen Lab route state`, async () => {
    const { screen } = await renderRoute({
      initialLocation: scenario.entryPath,
      queryData: [
        appConfigQueryData(),
        {
          queryKey: getTermsQueryOptions('en').queryKey,
          data: { terms: [] },
        },
      ],
    });

    await expect
      .element(screen.getByText(scenario.expectedText, { exact: true }).first())
      .toBeVisible();
  });
}

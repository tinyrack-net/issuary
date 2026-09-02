import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { AppConfigs } from '#frontend/queries/config.ts';
import { getTermsQueryOptions } from '#frontend/queries/terms.ts';
import '#frontend/index.css';
import {
  appConfigQueryData,
  routeTestAppConfig,
} from '#frontend/test-utils/route-screen-fixtures.ts';
import { createRouteScreen } from '#frontend/test-utils/route-test-fixture.tsx';
import { getRouteScreenDefinition } from '#frontend/test-utils/screen-route-definitions.ts';
import {
  findScreenScenarioDefinition,
  findScreenScenarioVariant,
} from '#frontend/test-utils/screen-scenario-catalog.ts';

const RootElement = document.getElementById('root');
const search = new URLSearchParams(window.location.search);
const scenario = findScreenScenarioDefinition(search.get('scenario') ?? '');

if (!RootElement) {
  throw new Error('Screen Lab route host root element was not found.');
}
if (scenario?.runtime !== 'route') {
  throw new Error('Screen Lab route host requires a route scenario.');
}

const variant = findScreenScenarioVariant(
  scenario,
  search.get('variant') ?? undefined,
);
if (!variant) {
  throw new Error(`Unknown Screen Lab variant for ${scenario.id}.`);
}

document.documentElement.lang = variant.locale;

const screenLabConfig = {
  ...routeTestAppConfig,
  i18n: {
    supported_languages: ['ko', 'en', 'ja'],
    default_language: variant.locale,
    fallback_language: 'en',
  },
  auth: {
    ...routeTestAppConfig.auth,
    passkey: {
      enabled: false,
    },
  },
} satisfies AppConfigs;

const { content } = await createRouteScreen(
  getRouteScreenDefinition(scenario.id),
  {
    initialLocation: scenario.entryPath,
    language: variant.locale,
    queryData: [
      appConfigQueryData(screenLabConfig),
      {
        queryKey: getTermsQueryOptions(variant.locale).queryKey,
        data: { terms: [] },
      },
    ],
  },
);

createRoot(RootElement).render(<StrictMode>{content}</StrictMode>);

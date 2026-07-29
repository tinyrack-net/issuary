import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initI18n, LANGUAGE_STORAGE_KEY } from '#frontend/i18n/index.ts';
import type { AppConfigs } from '#frontend/queries/config.ts';
import { getTermsQueryOptions } from '#frontend/queries/terms.ts';
import '#frontend/index.css';
import {
  appConfigQueryData,
  routeTestAppConfig,
} from '#frontend/test-utils/route-screen-fixtures.ts';
import { createRouteScreen } from '#frontend/test-utils/route-screen-renderer.tsx';
import {
  findScreenScenarioDefinition,
  findScreenScenarioVariant,
} from '#frontend/test-utils/screen-scenario-catalog.ts';

const COLOR_SCHEME_STORAGE_KEY = 'tinyauth-color-scheme';
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

localStorage.setItem(LANGUAGE_STORAGE_KEY, variant.locale);
localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, variant.colorScheme);
document.documentElement.lang = variant.locale;

const screenLabConfig = {
  ...routeTestAppConfig,
  i18n: {
    supported_languages: ['ko', 'en', 'ja'],
    default_language: variant.locale,
    fallback_language: 'en',
  },
  branding: {
    ...routeTestAppConfig.branding,
    background_url: '/e2e/screen-lab/background.svg',
  },
  auth: {
    ...routeTestAppConfig.auth,
    passkey: {
      enabled: false,
    },
  },
} satisfies AppConfigs;

initI18n({
  supportedLanguages: screenLabConfig.i18n.supported_languages,
  defaultLanguage: screenLabConfig.i18n.default_language,
  fallbackLanguage: screenLabConfig.i18n.fallback_language,
});

const { content } = await createRouteScreen({
  initialLocation: scenario.entryPath,
  queryData: [
    appConfigQueryData(screenLabConfig),
    {
      queryKey: getTermsQueryOptions(variant.locale).queryKey,
      data: { terms: [] },
    },
  ],
});

createRoot(RootElement).render(<StrictMode>{content}</StrictMode>);

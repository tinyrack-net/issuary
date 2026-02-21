import en from '@frontend/i18n/locales/en.json';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * Initialize i18n for unit tests.
 *
 * Uses English translations only with no language detection
 * or localStorage interaction, keeping tests deterministic.
 *
 * Call this once in the test file before rendering components
 * that use `useTranslation`.
 */
export function initTestI18n() {
  if (i18n.isInitialized) return;

  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
}

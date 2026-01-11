import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';

export const LANGUAGE_STORAGE_KEY = 'tinyrack-auth-language';

// All available translations (static)
const ALL_TRANSLATIONS = {
  ko: { translation: ko },
  en: { translation: en },
  ja: { translation: ja },
} as const;

export type AvailableLanguage = keyof typeof ALL_TRANSLATIONS;

/**
 * Check if a language code is available in translations
 */
export function isAvailableLanguage(lang: string): lang is AvailableLanguage {
  return lang in ALL_TRANSLATIONS;
}

/**
 * Detect browser language and map to available translation
 */
function detectBrowserLanguage(
  supportedLanguages: string[],
  fallbackLanguage: string,
): string {
  const browserLang = navigator.language.split('-')[0];
  if (
    browserLang &&
    supportedLanguages.includes(browserLang) &&
    isAvailableLanguage(browserLang)
  ) {
    return browserLang;
  }
  return fallbackLanguage;
}

/**
 * Get initial language based on priority:
 * 1. localStorage saved preference (if still supported)
 * 2. default_language from config (if 'auto', detect from browser)
 * 3. fallback_language from config
 */
function getInitialLanguage(
  supportedLanguages: string[],
  defaultLanguage: string,
  fallbackLanguage: string,
): string {
  // 1. Check localStorage
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (
    stored &&
    supportedLanguages.includes(stored) &&
    isAvailableLanguage(stored)
  ) {
    return stored;
  }

  // 2. Use default_language (or detect if 'auto')
  if (defaultLanguage === 'auto') {
    return detectBrowserLanguage(supportedLanguages, fallbackLanguage);
  }

  if (
    supportedLanguages.includes(defaultLanguage) &&
    isAvailableLanguage(defaultLanguage)
  ) {
    return defaultLanguage;
  }

  // 3. Fallback
  return fallbackLanguage;
}

/**
 * Initialize i18n with server config.
 * Call this after loading app config from backend.
 */
export function initI18n(config: {
  supportedLanguages: string[];
  defaultLanguage: string;
  fallbackLanguage: string;
}) {
  const { supportedLanguages, defaultLanguage, fallbackLanguage } = config;

  // Filter to only languages we have translations for
  const availableLanguages = supportedLanguages.filter(isAvailableLanguage);

  // Build resources for only supported languages
  const resources: Record<string, { translation: typeof ko }> = {};
  for (const lang of availableLanguages) {
    resources[lang] = ALL_TRANSLATIONS[lang];
  }

  // Ensure fallback language is available
  const safeFallback = isAvailableLanguage(fallbackLanguage)
    ? fallbackLanguage
    : 'en';

  // Always include fallback language in resources
  if (!resources[safeFallback]) {
    resources[safeFallback] = ALL_TRANSLATIONS[safeFallback];
  }

  const initialLanguage = getInitialLanguage(
    availableLanguages,
    defaultLanguage,
    safeFallback,
  );

  i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: safeFallback,
    supportedLngs: availableLanguages,
    interpolation: {
      escapeValue: false, // React handles XSS protection
    },
    react: {
      useSuspense: false, // Already using Suspense at app level
    },
  });

  return i18n;
}

export default i18n;

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';

export const LANGUAGE_STORAGE_KEY = 'issuary-language';

// All available translations with labels (static)
const ALL_TRANSLATIONS = {
  ko: { translation: ko, label: '한국어' },
  en: { translation: en, label: 'English' },
  ja: { translation: ja, label: '日本語' },
} as const;

export type AvailableLanguage = keyof typeof ALL_TRANSLATIONS;

/**
 * Language display labels for UI
 */
export const LANGUAGE_LABELS: Record<AvailableLanguage, string> = {
  ko: ALL_TRANSLATIONS.ko.label,
  en: ALL_TRANSLATIONS.en.label,
  ja: ALL_TRANSLATIONS.ja.label,
};

/**
 * Check if a language code is available in translations
 */
function isAvailableLanguage(lang: string): lang is AvailableLanguage {
  return lang in ALL_TRANSLATIONS;
}

/**
 * Filter supported languages to only those with available translations
 */
export function getAvailableLanguages(
  supportedLanguages: string[],
): AvailableLanguage[] {
  return supportedLanguages.filter(isAvailableLanguage);
}

/**
 * Detect browser language and return if available, otherwise fallback
 */
export function detectBrowserLanguage(
  availableLanguages: AvailableLanguage[],
  fallbackLanguage: string,
): AvailableLanguage {
  const browserLang = navigator.language.split('-')[0];
  if (
    browserLang &&
    isAvailableLanguage(browserLang) &&
    availableLanguages.includes(browserLang)
  ) {
    return browserLang;
  }
  return isAvailableLanguage(fallbackLanguage) ? fallbackLanguage : 'en';
}

/**
 * Get initial language based on priority:
 * 1. localStorage saved preference (if still supported)
 * 2. default_language from config (if 'auto', detect from browser)
 * 3. fallback_language from config
 */
function getInitialLanguage(
  availableLanguages: AvailableLanguage[],
  defaultLanguage: string,
  fallbackLanguage: string,
): string {
  // 1. Check localStorage
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (
    stored &&
    isAvailableLanguage(stored) &&
    availableLanguages.includes(stored)
  ) {
    return stored;
  }

  // 2. Use default_language (or detect if 'auto')
  if (defaultLanguage === 'auto') {
    return detectBrowserLanguage(availableLanguages, fallbackLanguage);
  }

  if (
    isAvailableLanguage(defaultLanguage) &&
    availableLanguages.includes(defaultLanguage)
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
  const availableLanguages = getAvailableLanguages(supportedLanguages);

  // Build resources for only supported languages
  const resources: Record<string, { translation: typeof ko }> = {};
  for (const lang of availableLanguages) {
    resources[lang] = { translation: ALL_TRANSLATIONS[lang].translation };
  }

  // Ensure fallback language is available
  const safeFallback = isAvailableLanguage(fallbackLanguage)
    ? fallbackLanguage
    : 'en';

  // Always include fallback language in resources
  if (!resources[safeFallback]) {
    resources[safeFallback] = {
      translation: ALL_TRANSLATIONS[safeFallback].translation,
    };
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

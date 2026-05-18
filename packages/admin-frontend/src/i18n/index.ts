import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';

const resources = {
  ko: { translation: ko },
  en: { translation: en },
  ja: { translation: ja },
};

export type AvailableLanguage = keyof typeof resources;

function isAvailableLanguage(language: string): language is AvailableLanguage {
  return language in resources;
}

export function initI18n(language = 'en') {
  const safeLanguage = isAvailableLanguage(language) ? language : 'en';

  if (i18n.isInitialized) {
    i18n.changeLanguage(safeLanguage);
    return i18n;
  }

  i18n.use(initReactI18next).init({
    resources,
    lng: safeLanguage,
    fallbackLng: 'en',
    supportedLngs: Object.keys(resources),
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

  return i18n;
}

export default i18n;

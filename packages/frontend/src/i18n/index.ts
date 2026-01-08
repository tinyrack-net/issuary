import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';

export const SUPPORTED_LANGUAGES = ['ko', 'en', 'ja'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_STORAGE_KEY = 'tinyrack-auth-language';

// 브라우저 언어 감지 (ko, en, ja 중 하나로 매핑)
const detectBrowserLanguage = (): Language => {
  const browserLang = navigator.language.split('-')[0];
  return SUPPORTED_LANGUAGES.includes(browserLang as Language)
    ? (browserLang as Language)
    : 'ko';
};

// 우선순위: localStorage > 브라우저 자동 감지 > fallback(ko)
const getInitialLanguage = (): Language => {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.includes(stored as Language)) {
    return stored as Language;
  }
  return detectBrowserLanguage();
};

i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en },
    ja: { translation: ja },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'ko',
  interpolation: {
    escapeValue: false, // React가 XSS 보호
  },
  react: {
    useSuspense: false, // 이미 앱 레벨에서 Suspense 사용 중
  },
});

export default i18n;

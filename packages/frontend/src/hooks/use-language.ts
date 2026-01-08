import { useTranslation } from 'react-i18next';
import type { Language } from '@/i18n';
import { SUPPORTED_LANGUAGES } from '@/i18n';

const LANGUAGE_STORAGE_KEY = 'tinyrack-auth-language';

export function useLanguage() {
  const { i18n } = useTranslation();

  const setLanguage = (lang: Language) => {
    i18n.changeLanguage(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  };

  return {
    language: i18n.language as Language,
    languages: SUPPORTED_LANGUAGES,
    setLanguage,
  };
}

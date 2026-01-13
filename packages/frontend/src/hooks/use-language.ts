import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { isAvailableLanguage, LANGUAGE_STORAGE_KEY } from '@/i18n/index.js';
import { appConfigQueryOptions } from '@/queries/config.js';

export function useLanguage() {
  const { i18n } = useTranslation();
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);

  // Get supported languages from server config
  const supportedLanguages = config.app.supported_languages;

  // Filter to only languages we have translations for
  const availableLanguages = supportedLanguages.filter(isAvailableLanguage);

  const setLanguage = (lang: string) => {
    if (
      !availableLanguages.includes(lang as (typeof availableLanguages)[number])
    ) {
      return;
    }
    i18n.changeLanguage(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  };

  return {
    language: i18n.language,
    languages: availableLanguages,
    setLanguage,
    // Show language selector only if more than one language is supported
    showLanguageSelector: availableLanguages.length > 1,
  };
}

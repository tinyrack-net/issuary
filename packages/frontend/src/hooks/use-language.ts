import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_STORAGE_KEY, isAvailableLanguage } from '@/i18n';
import { appConfigQueryOptions } from '@/queries/config';

export function useLanguage() {
  const { i18n } = useTranslation();
  const { data: config } = useQuery(appConfigQueryOptions);

  // Get supported languages from server config, fallback to current i18n language
  const supportedLanguages = config?.app.supported_languages ?? [i18n.language];

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

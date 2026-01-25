import { useSuspenseQuery } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
  detectBrowserLanguage,
  getAvailableLanguages,
  LANGUAGE_STORAGE_KEY,
} from '@/i18n/index.js';
import { appConfigQueryOptions } from '@/queries/config.js';

/**
 * Subscribe to localStorage changes for language preference
 */
function subscribeToLanguageStorage(callback: () => void) {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === LANGUAGE_STORAGE_KEY) {
      callback();
    }
  };
  window.addEventListener('storage', handleStorage);

  // Custom event for same-tab updates
  window.addEventListener('language-storage-change', callback);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('language-storage-change', callback);
  };
}

function getLanguageStorageSnapshot() {
  return localStorage.getItem(LANGUAGE_STORAGE_KEY);
}

function dispatchLanguageStorageChange() {
  window.dispatchEvent(new Event('language-storage-change'));
}

export function useLanguage() {
  const { i18n } = useTranslation();
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);

  // Get supported languages from server config
  const supportedLanguages = config.app.supported_languages;

  // Filter to only languages we have translations for
  const availableLanguages = getAvailableLanguages(supportedLanguages);

  // Sync with localStorage using useSyncExternalStore for proper reactivity
  const storedLanguage = useSyncExternalStore(
    subscribeToLanguageStorage,
    getLanguageStorageSnapshot,
    getLanguageStorageSnapshot,
  );

  // Check if user is in auto mode (no localStorage preference)
  const isAutoMode = storedLanguage === null;

  // Detect browser language for display in auto mode
  const detectedLanguage = detectBrowserLanguage(
    availableLanguages,
    config.app.fallback_language,
  );

  const setLanguage = useCallback(
    (lang: string) => {
      if (
        !availableLanguages.includes(
          lang as (typeof availableLanguages)[number],
        )
      ) {
        return;
      }
      i18n.changeLanguage(lang);
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      dispatchLanguageStorageChange();
    },
    [availableLanguages, i18n],
  );

  const setAutoLanguage = useCallback(() => {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    dispatchLanguageStorageChange();
    // Immediately switch to detected browser language
    i18n.changeLanguage(detectedLanguage);
  }, [detectedLanguage, i18n]);

  return {
    language: i18n.language,
    languages: availableLanguages,
    setLanguage,
    setAutoLanguage,
    isAutoMode,
    detectedLanguage,
    // Show language selector only if more than one language is supported
    showLanguageSelector: availableLanguages.length > 1,
  };
}

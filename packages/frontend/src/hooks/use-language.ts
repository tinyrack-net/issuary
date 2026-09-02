import { useSuspenseQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
  detectBrowserLanguage,
  getAvailableLanguages,
  LANGUAGE_STORAGE_KEY,
} from '#frontend/i18n/index.ts';
import {
  migrateStoredPreference,
  readPreferenceCookie,
  removePreferenceCookie,
  writePreferenceCookie,
} from '#frontend/libs/preferences.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';

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
  if (typeof window === 'undefined') return null;
  return (
    readPreferenceCookie(LANGUAGE_STORAGE_KEY) ??
    localStorage.getItem(LANGUAGE_STORAGE_KEY)
  );
}

function getLanguageServerSnapshot() {
  return null;
}

function dispatchLanguageStorageChange() {
  window.dispatchEvent(new Event('language-storage-change'));
}

export function useLanguage() {
  const { i18n } = useTranslation();
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);

  // Get supported languages from server config
  const supportedLanguages = config.i18n.supported_languages;

  // Filter to only languages we have translations for
  const availableLanguages = getAvailableLanguages(supportedLanguages);

  // Sync with localStorage using useSyncExternalStore for proper reactivity
  const storedLanguage = useSyncExternalStore(
    subscribeToLanguageStorage,
    getLanguageStorageSnapshot,
    getLanguageServerSnapshot,
  );

  // Check if user is in auto mode (no localStorage preference)
  const isAutoMode = storedLanguage === null;

  // Detect browser language for display in auto mode
  const detectedLanguage = detectBrowserLanguage(
    availableLanguages,
    config.i18n.fallback_language,
  );

  useEffect(() => {
    const migrated = migrateStoredPreference(LANGUAGE_STORAGE_KEY, (value) =>
      availableLanguages.some((language) => language === value),
    );
    if (migrated !== undefined) dispatchLanguageStorageChange();
  }, [availableLanguages]);

  const setLanguage = useCallback(
    (lang: string) => {
      if (!availableLanguages.some((language) => language === lang)) {
        return;
      }
      void i18n.changeLanguage(lang);
      writePreferenceCookie(LANGUAGE_STORAGE_KEY, lang);
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
      dispatchLanguageStorageChange();
    },
    [availableLanguages, i18n],
  );

  const setAutoLanguage = useCallback(() => {
    removePreferenceCookie(LANGUAGE_STORAGE_KEY);
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    dispatchLanguageStorageChange();
    // Immediately switch to detected browser language
    void i18n.changeLanguage(detectedLanguage);
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

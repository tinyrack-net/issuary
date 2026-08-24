import { useCallback, useEffect, useSyncExternalStore } from 'react';

type ColorScheme = 'light' | 'dark';

const STORAGE_KEY = 'issuary-color-scheme';

const COLOR_SCHEME_CHANGE_EVENT = 'issuary-color-scheme-change';

function getOsPreference(): ColorScheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function getStoredColorScheme(): ColorScheme | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return null;
}

function applyColorScheme(scheme: ColorScheme) {
  document.documentElement.setAttribute(
    'data-theme',
    scheme === 'dark' ? 'tinyrack-dark' : 'tinyrack-light',
  );
}

function subscribeToColorSchemeChanges(callback: () => void): () => void {
  window.addEventListener(COLOR_SCHEME_CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(COLOR_SCHEME_CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function getColorSchemeSnapshot(): ColorScheme | null {
  return getStoredColorScheme();
}

function getColorSchemeServerSnapshot(): ColorScheme | null {
  return null;
}

/**
 * Inline script string for anti-flicker.
 * Place this in HTML <head> to set data-theme before React renders.
 */
export const colorSchemeInitScript = `(function(){var s=localStorage.getItem('${STORAGE_KEY}');var c=s||(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',c==='dark'?'tinyrack-dark':'tinyrack-light')})()`;

export function useColorScheme() {
  const storedScheme = useSyncExternalStore(
    subscribeToColorSchemeChanges,
    getColorSchemeSnapshot,
    getColorSchemeServerSnapshot,
  );

  const hasStoredPreference = storedScheme !== null;

  const colorScheme: ColorScheme = hasStoredPreference
    ? (storedScheme as ColorScheme)
    : getOsPreference();

  useEffect(() => {
    applyColorScheme(colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    if (hasStoredPreference) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      applyColorScheme(mediaQuery.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [hasStoredPreference]);

  const toggleColorScheme = useCallback(() => {
    const next: ColorScheme = colorScheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent(COLOR_SCHEME_CHANGE_EVENT));
  }, [colorScheme]);

  return { colorScheme, toggleColorScheme };
}

import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react';
import {
  migrateStoredPreference,
  readPreferenceCookie,
  writePreferenceCookie,
} from '#frontend/libs/preferences.ts';

export type ColorScheme = 'light' | 'dark';

export const COLOR_SCHEME_STORAGE_KEY = 'issuary-color-scheme';
const COLOR_SCHEME_CHANGE_EVENT = 'issuary-color-scheme-change';
const InitialColorSchemeContext = createContext<ColorScheme | undefined>(
  undefined,
);

function isColorScheme(value: string): value is ColorScheme {
  return value === 'light' || value === 'dark';
}

function getOsPreference(): ColorScheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function getStoredColorScheme(): ColorScheme | null {
  if (typeof window === 'undefined') return null;
  const stored =
    readPreferenceCookie(COLOR_SCHEME_STORAGE_KEY) ??
    localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
  return stored !== null && stored !== undefined && isColorScheme(stored)
    ? stored
    : null;
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

export function ColorSchemeProvider({
  initialColorScheme,
  children,
}: {
  initialColorScheme: ColorScheme;
  children: ReactNode;
}) {
  return createElement(
    InitialColorSchemeContext.Provider,
    { value: initialColorScheme },
    children,
  );
}

export function useColorScheme() {
  const initialColorScheme = useContext(InitialColorSchemeContext);
  const storedScheme = useSyncExternalStore(
    subscribeToColorSchemeChanges,
    getColorSchemeSnapshot,
    getColorSchemeServerSnapshot,
  );
  const colorScheme = storedScheme ?? initialColorScheme ?? getOsPreference();

  useEffect(() => {
    const migrated = migrateStoredPreference(
      COLOR_SCHEME_STORAGE_KEY,
      isColorScheme,
    );
    if (migrated !== undefined) {
      window.dispatchEvent(new CustomEvent(COLOR_SCHEME_CHANGE_EVENT));
    }
  }, []);

  useEffect(() => {
    applyColorScheme(colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    if (storedScheme !== null) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyColorScheme(getOsPreference());
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [storedScheme]);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    writePreferenceCookie(COLOR_SCHEME_STORAGE_KEY, scheme);
    localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(COLOR_SCHEME_CHANGE_EVENT));
  }, []);

  const toggleColorScheme = useCallback(() => {
    setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
  }, [colorScheme, setColorScheme]);

  return { colorScheme, setColorScheme, toggleColorScheme };
}

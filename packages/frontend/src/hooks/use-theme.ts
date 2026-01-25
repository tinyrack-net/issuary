import { useSuspenseQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  appConfigQueryOptions,
  type Theme,
  type ThemeMode,
} from '@/queries/config.js';

const THEME_MODE_STORAGE_KEY = 'tinyrack-auth-theme-mode';

/**
 * Get the system's preferred color scheme
 */
function getSystemThemePreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Get the stored theme mode from localStorage
 */
function getStoredThemeMode(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return null;
}

/**
 * Apply theme to the document
 */
function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Resolve the actual theme based on mode and server config
 */
function resolveTheme(
  mode: ThemeMode,
  lightTheme: Theme,
  darkTheme: Theme,
): Theme {
  if (mode === 'system') {
    const systemPreference = getSystemThemePreference();
    return systemPreference === 'dark' ? darkTheme : lightTheme;
  }
  return mode === 'dark' ? darkTheme : lightTheme;
}

// Custom event for theme mode changes
const THEME_MODE_CHANGE_EVENT = 'tinyrack-theme-mode-change';

function subscribeToThemeModeChanges(callback: () => void): () => void {
  window.addEventListener(THEME_MODE_CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(THEME_MODE_CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function getThemeModeSnapshot(): ThemeMode | null {
  return getStoredThemeMode();
}

function getServerThemeModeSnapshot(): ThemeMode | null {
  return null;
}

export function useTheme() {
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);

  // Get server defaults
  const serverLightTheme = config.app.light_theme;
  const serverDarkTheme = config.app.dark_theme;
  const serverThemeMode = config.app.theme_mode;

  // Theme toggle is only allowed when server theme_mode is 'system'
  const canToggleTheme = serverThemeMode === 'system';

  // Subscribe to theme mode changes from localStorage
  const storedThemeMode = useSyncExternalStore(
    subscribeToThemeModeChanges,
    getThemeModeSnapshot,
    getServerThemeModeSnapshot,
  );

  // Determine current theme mode
  // If server mode is not 'system', always use server mode (user cannot override)
  // If server mode is 'system', user preference takes priority
  const themeMode = useMemo<ThemeMode>(() => {
    if (!canToggleTheme) {
      return serverThemeMode;
    }
    return storedThemeMode ?? serverThemeMode;
  }, [canToggleTheme, storedThemeMode, serverThemeMode]);

  // Resolve actual theme from mode
  const currentTheme = useMemo<Theme>(() => {
    return resolveTheme(themeMode, serverLightTheme, serverDarkTheme);
  }, [themeMode, serverLightTheme, serverDarkTheme]);

  // Apply theme to document
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  // Listen for system theme changes when mode is 'system'
  useEffect(() => {
    if (themeMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const newTheme = resolveTheme(
        'system',
        serverLightTheme,
        serverDarkTheme,
      );
      applyTheme(newTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode, serverLightTheme, serverDarkTheme]);

  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      // Only allow setting theme mode if server allows it
      if (!canToggleTheme) return;
      localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
      window.dispatchEvent(new CustomEvent(THEME_MODE_CHANGE_EVENT));
    },
    [canToggleTheme],
  );

  const toggleDarkMode = useCallback(() => {
    // Only allow toggling if server allows it
    if (!canToggleTheme) return;

    const currentMode = getStoredThemeMode() ?? serverThemeMode;
    // If system mode, check current actual theme to determine toggle direction
    if (currentMode === 'system') {
      const systemPref = getSystemThemePreference();
      const newMode = systemPref === 'dark' ? 'light' : 'dark';
      setThemeMode(newMode);
    } else {
      const newMode = currentMode === 'dark' ? 'light' : 'dark';
      setThemeMode(newMode);
    }
  }, [canToggleTheme, serverThemeMode, setThemeMode]);

  const cycleThemeMode = useCallback(() => {
    // Only allow cycling if server allows it
    if (!canToggleTheme) return;

    const currentMode = storedThemeMode ?? 'system';
    // Cycle: system -> light -> dark -> system
    let nextMode: ThemeMode;
    if (currentMode === 'system') {
      nextMode = 'light';
    } else if (currentMode === 'light') {
      nextMode = 'dark';
    } else {
      nextMode = 'system';
    }

    if (nextMode === 'system') {
      localStorage.removeItem(THEME_MODE_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_MODE_STORAGE_KEY, nextMode);
    }
    window.dispatchEvent(new CustomEvent(THEME_MODE_CHANGE_EVENT));
  }, [canToggleTheme, storedThemeMode]);

  const setAutoTheme = useCallback(() => {
    if (!canToggleTheme) return;
    localStorage.removeItem(THEME_MODE_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(THEME_MODE_CHANGE_EVENT));
  }, [canToggleTheme]);

  // Check if user is in auto mode (no localStorage preference)
  const isAutoMode = storedThemeMode === null;

  // Detected theme when in system mode
  const detectedTheme = useMemo(() => {
    const systemPref = getSystemThemePreference();
    return systemPref === 'dark' ? serverDarkTheme : serverLightTheme;
  }, [serverDarkTheme, serverLightTheme]);

  return {
    themeMode,
    currentTheme,
    lightTheme: serverLightTheme,
    darkTheme: serverDarkTheme,
    canToggleTheme,
    setThemeMode,
    toggleDarkMode,
    cycleThemeMode,
    setAutoTheme,
    isAutoMode,
    detectedTheme,
  };
}

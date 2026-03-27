import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

const themeMocks = vi.hoisted(() => ({
  serverThemeMode: 'system',
  prefersDark: false,
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );

  return {
    ...actual,
    useSuspenseQuery: () => ({
      data: {
        branding: {
          light_theme: 'lofi',
          dark_theme: 'night',
          theme_mode: themeMocks.serverThemeMode,
        },
      },
    }),
  };
});

import { useTheme } from './use-theme.ts';

function ThemeProbe() {
  const {
    themeMode,
    canToggleTheme,
    cycleThemeMode,
    detectedTheme,
    isAutoMode,
  } = useTheme();

  return (
    <div>
      <div data-testid="theme-mode">{themeMode}</div>
      <div data-testid="detected-theme">{detectedTheme}</div>
      <div data-testid="can-toggle">{String(canToggleTheme)}</div>
      <div data-testid="is-auto">{String(isAutoMode)}</div>
      <button onClick={cycleThemeMode} type="button">
        cycle
      </button>
    </div>
  );
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    themeMocks.serverThemeMode = 'system';
    themeMocks.prefersDark = false;

    vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
      matches: themeMocks.prefersDark,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  test('applies the server-enforced dark theme and disables user cycling', async () => {
    themeMocks.serverThemeMode = 'dark';

    const screen = await render(<ThemeProbe />);

    await expect
      .element(screen.getByTestId('theme-mode'))
      .toHaveTextContent('dark');
    await expect
      .element(screen.getByTestId('can-toggle'))
      .toHaveTextContent('false');
    expect(document.documentElement.getAttribute('data-theme')).toBe('night');

    await screen.getByRole('button', { name: 'cycle' }).click();

    expect(localStorage.getItem('tinyauth-theme-mode')).toBeNull();
  });

  test('cycles from system to light mode when user overrides the theme', async () => {
    themeMocks.serverThemeMode = 'system';
    themeMocks.prefersDark = true;

    const screen = await render(<ThemeProbe />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('night');
    await expect
      .element(screen.getByTestId('is-auto'))
      .toHaveTextContent('true');

    await screen.getByRole('button', { name: 'cycle' }).click();

    await expect
      .element(screen.getByTestId('theme-mode'))
      .toHaveTextContent('light');
    await expect
      .element(screen.getByTestId('is-auto'))
      .toHaveTextContent('false');
    expect(localStorage.getItem('tinyauth-theme-mode')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('lofi');
  });
});

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { removePreferenceCookie } from '#frontend/libs/preferences.ts';

const colorSchemeMocks = vi.hoisted(() => ({
  prefersDark: false,
}));

import { useColorScheme } from './use-theme.ts';

const COLOR_SCHEME_COOKIE = 'issuary-color-scheme';

function ColorSchemeProbe() {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  return (
    <div>
      <div data-testid="color-scheme">{colorScheme}</div>
      <button onClick={toggleColorScheme} type="button">
        toggle
      </button>
    </div>
  );
}

describe('useColorScheme', () => {
  beforeEach(() => {
    localStorage.clear();
    removePreferenceCookie(COLOR_SCHEME_COOKIE);
    document.documentElement.removeAttribute('data-theme');
    colorSchemeMocks.prefersDark = false;

    vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
      matches: colorSchemeMocks.prefersDark,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  test('defaults to light when OS prefers light and no stored value', async () => {
    colorSchemeMocks.prefersDark = false;

    const screen = await render(<ColorSchemeProbe />);

    await expect
      .element(screen.getByTestId('color-scheme'))
      .toHaveTextContent('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'tinyrack-light',
    );
    expect(localStorage.getItem('issuary-color-scheme')).toBeNull();
  });

  test('defaults to dark when OS prefers dark and no stored value', async () => {
    colorSchemeMocks.prefersDark = true;

    const screen = await render(<ColorSchemeProbe />);

    await expect
      .element(screen.getByTestId('color-scheme'))
      .toHaveTextContent('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'tinyrack-dark',
    );
  });

  test('uses stored preference over OS preference', async () => {
    colorSchemeMocks.prefersDark = false;
    localStorage.setItem('issuary-color-scheme', 'dark');

    const screen = await render(<ColorSchemeProbe />);

    await expect
      .element(screen.getByTestId('color-scheme'))
      .toHaveTextContent('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'tinyrack-dark',
    );
  });

  test('toggles from light to dark and saves an SSR-visible cookie', async () => {
    colorSchemeMocks.prefersDark = false;

    const screen = await render(<ColorSchemeProbe />);

    await expect
      .element(screen.getByTestId('color-scheme'))
      .toHaveTextContent('light');

    await screen.getByRole('button', { name: 'toggle' }).click();

    await expect
      .element(screen.getByTestId('color-scheme'))
      .toHaveTextContent('dark');
    expect(document.cookie).toContain(`${COLOR_SCHEME_COOKIE}=dark`);
    expect(localStorage.getItem(COLOR_SCHEME_COOKIE)).toBeNull();
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'tinyrack-dark',
    );
  });

  test('toggles from dark to light and saves an SSR-visible cookie', async () => {
    localStorage.setItem('issuary-color-scheme', 'dark');

    const screen = await render(<ColorSchemeProbe />);

    await expect
      .element(screen.getByTestId('color-scheme'))
      .toHaveTextContent('dark');

    await screen.getByRole('button', { name: 'toggle' }).click();

    await expect
      .element(screen.getByTestId('color-scheme'))
      .toHaveTextContent('light');
    expect(document.cookie).toContain(`${COLOR_SCHEME_COOKIE}=light`);
    expect(localStorage.getItem(COLOR_SCHEME_COOKIE)).toBeNull();
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'tinyrack-light',
    );
  });

  test('applies correct data-theme value', async () => {
    localStorage.setItem('issuary-color-scheme', 'dark');
    await render(<ColorSchemeProbe />);

    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'tinyrack-dark',
    );
  });
});

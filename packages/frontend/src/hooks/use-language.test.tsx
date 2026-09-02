import i18n from 'i18next';
import { beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { initTestI18n } from '#frontend/test-utils/i18n.ts';

const { useSuspenseQueryMock } = vi.hoisted(() => ({
  useSuspenseQueryMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );
  return {
    ...actual,
    useSuspenseQuery: useSuspenseQueryMock,
  };
});

import { LANGUAGE_STORAGE_KEY } from '#frontend/i18n/index.ts';
import { removePreferenceCookie } from '#frontend/libs/preferences.ts';
import { useLanguage } from './use-language.ts';

function LanguageHarness() {
  const {
    detectedLanguage,
    isAutoMode,
    language,
    setAutoLanguage,
    setLanguage,
    showLanguageSelector,
  } = useLanguage();

  return (
    <div>
      <div data-testid="detected-language">{detectedLanguage}</div>
      <div data-testid="is-auto">{String(isAutoMode)}</div>
      <div data-testid="language">{language}</div>
      <div data-testid="show-selector">{String(showLanguageSelector)}</div>
      <button onClick={() => setLanguage('ko')} type="button">
        set-ko
      </button>
      <button onClick={setAutoLanguage} type="button">
        set-auto
      </button>
    </div>
  );
}

beforeAll(() => {
  initTestI18n();
});

beforeEach(async () => {
  localStorage.clear();
  removePreferenceCookie(LANGUAGE_STORAGE_KEY);
  await i18n.changeLanguage('en');

  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: 'ja-JP',
  });
});

test('detects the browser language when the user is in auto mode', async () => {
  useSuspenseQueryMock.mockReturnValue({
    data: {
      i18n: {
        fallback_language: 'en',
        supported_languages: ['en', 'ja', 'ko'],
      },
    },
  });

  const screen = await render(<LanguageHarness />);

  await expect
    .element(screen.getByTestId('detected-language'))
    .toHaveTextContent('ja');
  await expect.element(screen.getByTestId('is-auto')).toHaveTextContent('true');
  await expect
    .element(screen.getByTestId('show-selector'))
    .toHaveTextContent('true');
});

test('persists manual language changes in the SSR-visible cookie and i18n state', async () => {
  useSuspenseQueryMock.mockReturnValue({
    data: {
      i18n: {
        fallback_language: 'en',
        supported_languages: ['en', 'ja', 'ko'],
      },
    },
  });

  const screen = await render(<LanguageHarness />);

  await screen.getByRole('button', { name: 'set-ko' }).click();

  await expect.element(screen.getByTestId('language')).toHaveTextContent('ko');
  await expect
    .element(screen.getByTestId('is-auto'))
    .toHaveTextContent('false');
  expect(document.cookie).toContain(`${LANGUAGE_STORAGE_KEY}=ko`);
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
});

test('returns to auto mode and switches to the detected browser language', async () => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'ko');
  useSuspenseQueryMock.mockReturnValue({
    data: {
      i18n: {
        fallback_language: 'en',
        supported_languages: ['en', 'ja', 'ko'],
      },
    },
  });

  const screen = await render(<LanguageHarness />);

  await screen.getByRole('button', { name: 'set-auto' }).click();

  await expect.element(screen.getByTestId('language')).toHaveTextContent('ja');
  await expect.element(screen.getByTestId('is-auto')).toHaveTextContent('true');
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  expect(document.cookie).not.toContain(`${LANGUAGE_STORAGE_KEY}=`);
});

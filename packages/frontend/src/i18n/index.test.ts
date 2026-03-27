import { afterEach, describe, expect, test } from 'vitest';
import {
  detectBrowserLanguage,
  getAvailableLanguages,
  LANGUAGE_STORAGE_KEY,
} from './index.ts';

function setNavigatorLanguage(language: string) {
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: language,
  });
}

describe('i18n helpers', () => {
  afterEach(() => {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    setNavigatorLanguage('en-US');
  });

  test('filters supported languages to only languages with bundled translations', () => {
    expect(getAvailableLanguages(['en', 'de', 'ja', 'custom'])).toEqual([
      'en',
      'ja',
    ]);
  });

  test('prefers the browser language when it is available', () => {
    setNavigatorLanguage('ja-JP');

    expect(detectBrowserLanguage(['en', 'ja'], 'en')).toBe('ja');
  });

  test('falls back when the browser language is unavailable', () => {
    setNavigatorLanguage('fr-FR');

    expect(detectBrowserLanguage(['en', 'ko'], 'ko')).toBe('ko');
  });
});

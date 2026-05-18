import { describe, expect, test } from 'vitest';
import en from '#admin/i18n/locales/en.json';
import ja from '#admin/i18n/locales/ja.json';
import ko from '#admin/i18n/locales/ko.json';

const requiredLabels = [
  'app.title',
  'auth.loginRequired.title',
  'auth.accessDenied.title',
  'dashboard.title',
  'users.title',
  'oauthProviders.title',
  'oauthClients.title',
];

function flattenLabels(
  value: unknown,
  prefix = '',
  labels = new Map<string, string>(),
): Map<string, string> {
  if (typeof value === 'string') {
    labels.set(prefix, value);
    return labels;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return labels;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    flattenLabels(nestedValue, prefix ? `${prefix}.${key}` : key, labels);
  }

  return labels;
}

describe('admin translations', () => {
  test('include required labels in ko, en, and ja', () => {
    for (const locale of [ko, en, ja]) {
      const labels = flattenLabels(locale);

      for (const label of requiredLabels) {
        expect(labels.get(label)).toBeTruthy();
      }
    }
  });
});

import {
  AVAILABLE_LOCALES,
  DEFAULT_LOCALE,
  type EmailTranslations,
  type Locale,
} from '@/lib/locale.js';
import en from './en.json' with { type: 'json' };
import ja from './ja.json' with { type: 'json' };
import ko from './ko.json' with { type: 'json' };

const translations: Record<Locale, EmailTranslations> = { en, ko, ja };

export const getTranslations = (locale?: Locale): EmailTranslations => {
  if (locale && AVAILABLE_LOCALES.includes(locale)) {
    return translations[locale];
  }
  return translations[DEFAULT_LOCALE];
};

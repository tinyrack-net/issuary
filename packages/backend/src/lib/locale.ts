/**
 * Centralized locale constants for the application.
 *
 * AVAILABLE_LOCALES: All locales the application CAN support (compile-time).
 *                    These have corresponding translation files.
 *
 * config.app.supported_languages: Locales ENABLED for a deployment (runtime).
 *                                  Must be a subset of AVAILABLE_LOCALES.
 */

/**
 * All locales the application can support.
 * Each locale listed here must have corresponding translation files.
 */
export const AVAILABLE_LOCALES = ['en', 'ko', 'ja'] as const;

/**
 * Type representing any available locale.
 */
export type Locale = (typeof AVAILABLE_LOCALES)[number];

/**
 * Default locale used as fallback.
 */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Check if a string is a valid available locale.
 */
export const isAvailableLocale = (code: string): code is Locale => {
  return (AVAILABLE_LOCALES as ReadonlyArray<string>).includes(code);
};

/**
 * Email translation structure type.
 * Matches the structure of email translation JSON files.
 */
export interface EmailTranslations {
  verification: {
    subject: string;
    title: string;
    greeting: string;
    description: string;
    buttonText: string;
    linkAlt: string;
    codeLabel: string;
    expiry: string;
    ignore: string;
  };
  passwordReset: {
    subject: string;
    title: string;
    description: string;
    buttonText: string;
    linkAlt: string;
    codeLabel: string;
    expiry: string;
    ignore: string;
  };
  common: {
    poweredBy: string;
  };
}

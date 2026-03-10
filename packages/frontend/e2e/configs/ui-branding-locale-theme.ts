import type { TinyAuthConfigs } from '@tinyauth/backend/config';
import {
  E2E_BASE_APP_CONFIG,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates a UI-focused backend configuration for e2e tests.
 * Custom branding, single-language mode, and fixed theme mode.
 */
export function createUiBrandingLocaleThemeConfig(
  backendPort: number,
  _frontendPort: number,
): TinyAuthConfigs {
  return {
    ...E2E_BASE_CONFIG,
    app: {
      ...E2E_BASE_APP_CONFIG,
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      allowed_signup_emails: ['*'],
      supported_languages: ['en'],
      default_language: 'en',
      fallback_language: 'en',
      light_theme: 'light',
      dark_theme: 'dark',
      theme_mode: 'light',
      background_url: 'https://example.com/e2e-background.jpg',
      icon_url: 'https://example.com/e2e-icon.svg',
      title: {
        en: 'E2E Brand Title',
      },
      subtitle: {
        en: 'E2E Brand Subtitle',
      },
    },
  };
}

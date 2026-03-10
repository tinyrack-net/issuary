import type { TinyAuthConfigs } from '@tinyauth/backend/config';
import {
  E2E_BASE_APP_CONFIG,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates a system-theme and multi-language config for e2e tests.
 */
export function createThemeSystemMultilangConfig(
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
      supported_languages: ['ko', 'en'],
      default_language: 'ko',
      fallback_language: 'en',
      light_theme: 'cupcake',
      dark_theme: 'forest',
      theme_mode: 'system',
      title: {
        en: 'Theme System Title',
      },
      subtitle: {
        en: 'Theme System Subtitle',
      },
      signup_implicit_terms: {
        en: 'Theme system <strong>implicit terms</strong> notice.',
      },
    },
  };
}

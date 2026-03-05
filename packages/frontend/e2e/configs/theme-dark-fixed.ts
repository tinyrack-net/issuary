import type { ResolvedAppConfig } from '@tinyauth/backend/config';
import {
  E2E_BASE_APP_CONFIG,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates a fixed dark-theme backend configuration for e2e tests.
 * Theme selector should be hidden and dark theme should always win.
 */
export function createThemeDarkFixedConfig(
  backendPort: number,
  _frontendPort: number,
): ResolvedAppConfig {
  return {
    ...E2E_BASE_CONFIG,
    app: {
      ...E2E_BASE_APP_CONFIG,
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      cookie_secret:
        '70d4e6f8a0b2c4d6e8f0112233445566778899aabbccddeeff00112233445566',
      allowed_signup_emails: ['*'],
      supported_languages: ['en'],
      default_language: 'en',
      fallback_language: 'en',
      light_theme: 'light',
      dark_theme: 'dark',
      theme_mode: 'dark',
    },
  };
}

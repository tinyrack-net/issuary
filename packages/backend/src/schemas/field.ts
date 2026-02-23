import {
  DEFAULT_LOCALE,
  isAvailableLocale,
  type Locale,
} from '@backend/lib/locale.js';
import { z } from 'zod';

export const f = {
  // Common fields
  uuid: z.uuid().describe('Entity UUID'),

  // User fields
  userSub: z.uuid().describe('User subject identifier (UUID)'),
  userEmail: z.email().describe('User email address'),
  userPassword: z.string().min(6).max(100).describe("User's password"),
  emailVerified: z.boolean().describe("Whether the user's email is verified"),

  // OAuth fields
  clientId: z.string().min(1).max(1000).describe('OAuth client ID'),
  clientSecret: z.string().min(1).max(1000).describe('OAuth client secret'),
  redirectUri: z.url().max(1000).describe('OAuth redirect URI'),
  scope: z.string().max(1000).describe('Space-delimited list of OAuth scopes'),
  responseType: z
    .string()
    .min(1)
    .max(100)
    .describe('OAuth response type (e.g., "code", "token")'),
  state: z
    .string()
    .min(1)
    .max(1000)
    .describe('OAuth state parameter for CSRF protection'),
  nonce: z
    .string()
    .min(1)
    .max(1000)
    .describe('OIDC nonce for replay attack prevention'),
  codeChallenge: z.string().min(1).max(1000).describe('PKCE code challenge'),
  codeChallengeMethod: z
    .enum(['S256', 'plain'])
    .describe('PKCE code challenge method'),
  codeVerifier: z
    .string()
    .min(43)
    .max(128)
    .describe('PKCE code verifier (43-128 characters)'),
  grantType: z
    .enum(['authorization_code', 'refresh_token'])
    .describe('OAuth grant type'),
  authorizationCode: z
    .string()
    .min(1)
    .max(1000)
    .describe('OAuth authorization code'),
  token: z
    .string()
    .min(1)
    .describe('Token string (verification, reset, or OAuth token)'),
  tokenTypeHint: z
    .enum(['access_token', 'refresh_token'])
    .describe('Hint about the type of token'),

  // OIDC fields
  prompt: z
    .enum(['none', 'login', 'consent', 'select_account'])
    .describe('OIDC prompt parameter'),
  display: z
    .enum(['page', 'popup', 'touch', 'wap'])
    .describe('OIDC display parameter'),
  maxAge: z.coerce
    .number()
    .int()
    .min(0)
    .describe('Maximum authentication age in seconds'),

  // Consent fields
  consentDecision: z.enum(['allow', 'deny']).describe('User consent decision'),

  // Provider fields
  providerName: z
    .string()
    .min(1)
    .describe('OAuth provider name (e.g., "google", "github")'),
  oauthConnectMode: z
    .enum(['login', 'register', 'link'])
    .describe('OAuth connect mode'),
  returnUrl: z
    .string()
    .min(1)
    .max(2000)
    .describe('Return URL or path to redirect after completion'),

  // i18n fields
  languageCode: z
    .string()
    .min(2)
    .max(10)
    .default('en')
    .describe('Language code for localized content'),

  /**
   * Accept-Language header schema with transform.
   * Parses header like "ko-KR,ko;q=0.9,en-US;q=0.8" into Locale.
   */
  acceptLanguage: z
    .string()
    .optional()
    .transform((val): Locale => {
      if (!val) {
        return DEFAULT_LOCALE;
      }

      // Parse Accept-Language header (e.g., "ko-KR,ko;q=0.9,en-US;q=0.8")
      const languages = val
        .split(',')
        .map((lang) => {
          const [code, qValue] = lang.trim().split(';q=');
          return {
            code: code?.split('-')[0]?.toLowerCase(),
            q: qValue ? Number.parseFloat(qValue) : 1,
          };
        })
        .filter((lang) => lang.code)
        .sort((a, b) => b.q - a.q);

      for (const lang of languages) {
        if (lang.code && isAvailableLocale(lang.code)) {
          return lang.code;
        }
      }

      return DEFAULT_LOCALE;
    })
    .describe('Accept-Language header (e.g., "ko-KR,ko;q=0.9,en;q=0.8")'),

  // TOTP fields
  totpCode: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, 'TOTP code must be 6 digits')
    .describe('6-digit TOTP code from authenticator app'),

  // TOTP Recovery Code fields
  recoveryCode: z
    .string()
    .regex(
      /^[a-z0-9]{4}-[a-z0-9]{4}$/,
      'Recovery code must be in format: xxxx-xxxx',
    )
    .describe('One-time recovery code for TOTP (format: xxxx-xxxx)'),

  // WebAuthn/Passkey fields
  base64UrlString: z.string().describe('Base64URL-encoded string'),
  passkeyCredentialId: z.string().describe('Passkey credential ID'),
  passkeyChallenge: z.string().describe('WebAuthn challenge'),
  passkeyName: z.string().min(1).max(100).describe('Passkey display name'),
  passkeyDeviceType: z
    .enum(['singleDevice', 'multiDevice'])
    .describe('Passkey device type'),
  authenticatorTransport: z
    .enum(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb'])
    .describe('Authenticator transport method'),
  userVerificationRequirement: z
    .enum(['required', 'preferred', 'discouraged'])
    .describe('User verification requirement'),
  publicKeyCredentialType: z
    .literal('public-key')
    .describe('Public key credential type'),
  authenticatorAttachment: z
    .enum(['platform', 'cross-platform'])
    .describe('Authenticator attachment type'),
  publicKeyCredentialHint: z
    .enum(['hybrid', 'security-key', 'client-device'])
    .describe('Public key credential hint'),
};

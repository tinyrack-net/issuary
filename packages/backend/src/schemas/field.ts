import z from 'zod/v4';

export const f = {
  // User fields
  userId: z.string().describe('User ID'),
  userEmail: z.email().describe('User email address'),
  userPassword: z.string().min(6).max(100).describe("User's password"),
  emailVerified: z.boolean().describe("Whether the user's email is verified"),

  // OAuth fields
  clientId: z.string().min(1).max(1000).describe('OAuth client ID'),
  clientSecret: z.string().min(1).max(1000).describe('OAuth client secret'),
  redirectUri: z.string().min(1).max(1000).describe('OAuth redirect URI'),
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
  token: z
    .string()
    .min(1)
    .describe('Token string (verification, reset, or OAuth token)'),
  tokenTypeHint: z
    .enum(['access_token', 'refresh_token'])
    .describe('Hint about the type of token'),

  // Provider fields
  providerName: z
    .string()
    .min(1)
    .describe('OAuth provider name (e.g., "google", "github")'),

  // TOTP fields
  totpCode: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, 'TOTP code must be 6 digits')
    .describe('6-digit TOTP code from authenticator app'),

  // WebAuthn/Passkey fields
  base64UrlString: z.string().describe('Base64URL-encoded string'),
  passkeyCredentialId: z.string().describe('Passkey credential ID'),
  passkeyChallenge: z.string().describe('WebAuthn challenge'),
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

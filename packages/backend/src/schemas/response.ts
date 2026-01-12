import z from 'zod/v4';
import type { PublicKeyCredentialRequestOptionsJSON as SimpleWebAuthnOptionsJSON } from '@simplewebauthn/server';
import { AppTheme } from '@/lib/config.js';
import { f } from './field.js';

// Base schemas
const UserSession = z
  .object({
    managed: z.literal(['database', 'config']),
    id: f.userId,
    email: f.userEmail,
    email_verified: f.emailVerified,
    has_password: z.boolean().describe('Whether the user has a password set'),
    totp_enabled: z.boolean().describe('Whether TOTP is enabled for the user'),
    passkey_count: z
      .number()
      .int()
      .describe('Number of passkeys registered for the user'),
  })
  .describe('UserSession');

const OAuthClient = z
  .object({
    id: z.string(),
    clientId: z.string(),
    name: z.string(),
    managed: z.enum(['config', 'database']),
    enabled: z.boolean(),
    redirectUris: z.array(z.string()),
    responseTypes: z.array(z.string()),
    scopes: z.array(z.string()),
    grantTypes: z.array(z.string()),
  })
  .describe('OAuth Client Information');

const OAuthProvider = z
  .object({
    name: z.string(),
    display_name: z.string(),
    icon_url: z.string().optional(),
  })
  .describe('OAuth Provider');

const ConsentClient = z
  .object({
    id: z.string(),
    clientId: z.string(),
    name: z.string(),
  })
  .describe('Consent Client Information');

const ConsentScope = z
  .object({
    name: z.string(),
    description: z.string(),
  })
  .describe('Consent Scope');

const ConsentUser = z
  .object({
    id: z.string(),
    email: z.string(),
  })
  .describe('Consent User');

const LinkedOAuthAccount = z
  .object({
    provider_name: z.string(),
    linked_at: z.date(),
  })
  .describe('Linked OAuth Account');

const AvailableOAuthProvider = z
  .object({
    name: z.string(),
    display_name: z.string(),
    icon_url: z.string().optional(),
    linked: z.boolean(),
  })
  .describe('Available OAuth Provider');

// Generic response schemas
const GenericError = z
  .object({
    code: z.string(),
    message: z.string(),
  })
  .describe('Generic Error Response');

const OAuthError = z
  .object({
    error: z.string(),
    error_description: z.string(),
  })
  .describe('OAuth Error Response');

const MessageResponse = z
  .object({
    message: z.string(),
  })
  .describe('Message Response');

const SuccessResponse = z
  .object({
    success: z.boolean(),
  })
  .describe('Success Response');

const OkResponse = z
  .object({
    ok: z.literal(true),
  })
  .describe('OK Response');

const RedirectUrlResponse = z
  .object({
    redirect_url: z.string(),
  })
  .describe('Redirect URL Response');

// WebAuthn/Passkey schemas (based on @simplewebauthn/server types)

/**
 * PublicKeyCredentialDescriptorJSON schema
 * @see https://w3c.github.io/webauthn/#dictdef-publickeycredentialdescriptorjson
 */
const PublicKeyCredentialDescriptorJSON = z
  .object({
    id: f.base64UrlString,
    type: f.publicKeyCredentialType,
    transports: z.array(f.authenticatorTransport).optional(),
  })
  .describe('Public key credential descriptor');

/**
 * PublicKeyCredentialRequestOptionsJSON schema
 * Used for authentication options sent to the browser
 * @see https://w3c.github.io/webauthn/#dictdef-publickeycredentialrequestoptionsjson
 */
const PublicKeyCredentialRequestOptionsJSON = z
  .object({
    challenge: f.passkeyChallenge,
    timeout: z.number().int().optional().describe('Timeout in milliseconds'),
    rpId: z.string().optional().describe('Relying Party identifier'),
    allowCredentials: z
      .array(PublicKeyCredentialDescriptorJSON)
      .optional()
      .describe('Allowed credentials'),
    userVerification: f.userVerificationRequirement.optional(),
    hints: z.array(f.publicKeyCredentialHint).optional(),
    extensions: z.object({}).passthrough().optional(),
  })
  .passthrough()
  .describe('WebAuthn authentication options');

/**
 * AuthenticatorAssertionResponseJSON schema
 * @see https://w3c.github.io/webauthn/#dictdef-authenticatorassertionresponsejson
 */
const AuthenticatorAssertionResponseJSON = z
  .object({
    clientDataJSON: f.base64UrlString,
    authenticatorData: f.base64UrlString,
    signature: f.base64UrlString,
    userHandle: f.base64UrlString.optional(),
  })
  .describe('Authenticator assertion response');

/**
 * AuthenticationResponseJSON schema
 * Sent from browser after navigator.credentials.get()
 * @see https://w3c.github.io/webauthn/#dictdef-authenticationresponsejson
 */
const AuthenticationResponseJSON = z
  .object({
    id: f.passkeyCredentialId,
    rawId: f.base64UrlString,
    response: AuthenticatorAssertionResponseJSON,
    authenticatorAttachment: f.authenticatorAttachment.optional(),
    clientExtensionResults: z.record(z.string(), z.unknown()),
    type: f.publicKeyCredentialType,
  })
  .describe('WebAuthn authentication response');

export const r = {
  // Base schemas
  UserSession,
  OAuthClient,
  OAuthProvider,
  ConsentClient,
  ConsentScope,
  ConsentUser,
  LinkedOAuthAccount,
  AvailableOAuthProvider,

  // WebAuthn/Passkey schemas
  PublicKeyCredentialDescriptorJSON,
  PublicKeyCredentialRequestOptionsJSON,
  AuthenticatorAssertionResponseJSON,
  AuthenticationResponseJSON,

  // Generic responses
  GenericError,
  OAuthError,
  MessageResponse,
  SuccessResponse,
  OkResponse,
  RedirectUrlResponse,

  // Wrapped response schemas
  UserSessionResponse: z.object({
    user: UserSession,
  }),

  UserSessionNullableResponse: z.object({
    user: UserSession.nullable(),
  }),

  OAuthCallbackResponse: z.object({
    user: UserSession,
    is_new_user: z.boolean(),
    return_url: z.string().optional(),
  }),

  ProvidersResponse: z.object({
    providers: z.array(OAuthProvider),
  }),

  ConsentInfoResponse: z.object({
    client: ConsentClient,
    scopes: z.array(ConsentScope),
    user: ConsentUser,
  }),

  LinkedAccountsResponse: z.object({
    accounts: z.array(LinkedOAuthAccount),
    available_providers: z.array(AvailableOAuthProvider),
  }),

  // Token response (RFC 6749)
  TokenResponse: z.object({
    access_token: z.string().describe('OAuth 2.0 access token (JWT format)'),
    token_type: z.literal('Bearer').describe('Token type identifier'),
    expires_in: z.number().int().describe('Access token lifetime in seconds'),
    refresh_token: z
      .string()
      .optional()
      .describe('Refresh token for obtaining new access tokens'),
    id_token: z
      .string()
      .optional()
      .describe('OpenID Connect ID Token (JWT format)'),
    scope: z.string().describe('Space-separated list of granted scopes'),
  }),

  // Introspection response (RFC 7662)
  IntrospectionResponse: z.object({
    active: z.boolean().describe('Whether the token is currently active'),
    scope: z.string().optional(),
    client_id: z.string().optional(),
    token_type: z.literal('Bearer').optional(),
    exp: z.number().int().optional(),
    iat: z.number().int().optional(),
    sub: z.string().optional(),
    iss: z.string().optional(),
  }),

  // UserInfo response (OIDC Core)
  UserInfoResponse: z.object({
    sub: z.string().describe('Subject identifier'),
    email: z.string().optional(),
    email_verified: z.boolean().optional(),
    name: z.string().optional(),
    picture: z.string().optional(),
    preferred_username: z.string().optional(),
  }),

  // Health check response
  HealthResponse: z.object({
    status: z.literal('ok'),
    version: z.string(),
    uptime: z.number().describe('Uptime in seconds'),
    checks: z.object({
      database: z.literal('ok'),
    }),
  }),

  HealthErrorResponse: z.object({
    status: z.literal('error'),
    version: z.string(),
    uptime: z.number().describe('Uptime in seconds'),
    checks: z.object({
      database: z.enum(['ok', 'error']),
    }),
    error: z.string().optional(),
  }),

  // Liveness probe response
  LivenessResponse: z.object({
    status: z.literal('ok'),
  }),

  // Readiness probe response
  ReadinessResponse: z.object({
    status: z.literal('ok'),
    checks: z.object({
      database: z.literal('ok'),
    }),
  }),

  ReadinessErrorResponse: z.object({
    status: z.literal('error'),
    checks: z.object({
      database: z.enum(['ok', 'error']),
    }),
    error: z.string().optional(),
  }),

  // TOTP responses
  TotpStatusResponse: z.object({
    enabled: z.boolean().describe('Whether TOTP is enabled for the user'),
  }),

  TotpSetupResponse: z.object({
    secret: z.string().describe('TOTP secret key (base32 encoded)'),
    otpauth_url: z.string().describe('OTPAuth URL for authenticator apps'),
    qr_code: z.string().describe('QR code as data URL'),
  }),

  // Passkey responses
  // Use z.custom to maintain type compatibility with @simplewebauthn types
  // while still validating the structure through PublicKeyCredentialRequestOptionsJSON
  PasskeyAuthenticationOptionsResponse: z.object({
    options: z.custom<SimpleWebAuthnOptionsJSON>(
      (val) => PublicKeyCredentialRequestOptionsJSON.safeParse(val).success,
    ),
  }),

  // App config response
  ConfigResponse: z.object({
    app: z.object({
      supported_languages: z.array(z.string()),
      default_language: z.string(),
      fallback_language: z.string(),
      light_theme: AppTheme,
      dark_theme: AppTheme,
      theme_mode: z.enum(['light', 'dark', 'system']),
    }),
    database: z.object({
      enabled: z.boolean(),
    }),
    authentication_methods: z.record(
      z.string(),
      z
        .object({
          enabled: z.boolean(),
          type: z.string(),
          // Password auth method specific fields
          passkey: z
            .object({
              enabled: z.boolean(),
              required: z.boolean(),
            })
            .optional(),
          totp: z
            .object({
              enabled: z.boolean(),
              required: z.boolean(),
            })
            .optional(),
        })
        .passthrough(),
    ),
  }),
};

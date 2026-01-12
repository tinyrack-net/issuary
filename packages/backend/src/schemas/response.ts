import z from 'zod/v4';
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
      z.object({
        enabled: z.boolean(),
        type: z.string(),
      }),
    ),
  }),
};

import { z } from 'zod';
import {
  AppThemeSchema,
  PasskeyAuthConfigSchema,
  PasswordAuthConfigSchema,
  PasswordPolicyConfigSchema,
} from '#backend/lib/config/index.js';
import { f } from './field.js';
import { oauthSchema } from './oauth.js';

// Base schemas
const UserSession = z
  .object({
    managed_by: z
      .enum(['database', 'config'])
      .describe('User data source (database or static config)'),
    sub: f.userSub,
    email: f.userEmail,
    email_verified: f.emailVerified,
    email_verification_required: z
      .boolean()
      .describe('Whether email verification is required for the user'),
    has_password: z.boolean().describe('Whether the user has a password set'),
    totp_registered: z
      .boolean()
      .describe('Whether TOTP is registered for the user'),
    totp_recovery_codes_missing: z
      .boolean()
      .describe('Whether the user has no usable TOTP recovery codes left'),
    second_factor_required: z
      .boolean()
      .describe(
        'Whether the user is required to use 2FA (e.g., due to policy)',
      ),
    passkey_count: z
      .number()
      .int()
      .describe('Number of passkeys registered for the user'),
  })
  .describe('UserSession');

const OAuthClient = z
  .object({
    id: f.uuid.describe('OAuth client internal UUID'),
    clientId: f.clientId.describe('OAuth client ID exposed to clients'),
    name: z.string().describe('Display name of the OAuth client'),
    managed_by: z
      .enum(['config', 'database'])
      .describe('Whether the client is managed by config or database'),
    enabled: z.boolean().describe('Whether the client is enabled'),
    redirectUris: z.array(f.redirectUri).describe('Allowed redirect URIs'),
    responseTypes: z
      .array(z.string().min(1))
      .describe('Allowed OAuth response types'),
    scopes: z.array(z.string().min(1)).describe('Allowed OAuth scopes'),
    grantTypes: z
      .array(z.string().min(1))
      .describe('Allowed OAuth grant types'),
  })
  .describe('OAuth Client Information');

const ConsentClient = z
  .object({
    id: f.uuid.describe('OAuth client internal UUID'),
    clientId: f.clientId.describe('OAuth client ID'),
    name: z.string().describe('OAuth client display name'),
  })
  .describe('Consent Client Information');

const ConsentScope = z
  .object({
    name: z.string().describe('Scope name'),
    description: z.string().describe('Scope description shown to users'),
  })
  .describe('Consent Scope');

const ConsentUser = z
  .object({
    sub: f.userSub,
    email: f.userEmail,
  })
  .describe('Consent User');

const LinkedOAuthAccount = z
  .object({
    provider_name: f.providerName.describe('OAuth provider identifier'),
    linked_at: z.iso
      .datetime()
      .describe('Timestamp when the provider account was linked'),
  })
  .describe('Linked OAuth Account');

const AvailableOAuthProvider = z
  .object({
    id: z.string().describe('Provider identifier'),
    display_name: z.string().describe('Provider display name'),
    icon_url: z.url().optional().describe('Provider icon URL'),
    linked: z
      .boolean()
      .describe('Whether this provider is linked to the current user'),
  })
  .describe('Available OAuth Provider');

// Generic response schemas
const OAuthError = z
  .object({
    error: z.string().describe('OAuth/OIDC error code'),
    error_description: z.string().describe('Human-readable error description'),
  })
  .describe('OAuth Error Response');

const MessageResponse = z
  .object({
    message: z.string().describe('Response message'),
  })
  .describe('Message Response');

const OkResponse = z
  .object({
    ok: z.literal(true).describe('Indicates successful operation'),
  })
  .describe('OK Response');

const RedirectUrlResponse = z
  .object({
    redirect_url: z.url().describe('Absolute URL to redirect the user to'),
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
 * PublicKeyCredentialRpEntityJSON schema
 * @see https://w3c.github.io/webauthn/#dictdef-publickeycredentialrpentity
 */
const PublicKeyCredentialRpEntityJSON = z
  .object({
    name: z.string().describe('Relying Party name'),
    id: z.string().optional().describe('Relying Party identifier'),
  })
  .describe('Relying Party entity');

/**
 * PublicKeyCredentialUserEntityJSON schema
 * @see https://w3c.github.io/webauthn/#dictdef-publickeycredentialuserentityjson
 */
const PublicKeyCredentialUserEntityJSON = z
  .object({
    id: f.base64UrlString.describe('User handle'),
    name: z.string().describe('User account identifier'),
    displayName: z.string().describe('User display name'),
  })
  .describe('User entity');

/**
 * PublicKeyCredentialParametersJSON schema
 * @see https://w3c.github.io/webauthn/#dictdef-publickeycredentialparameters
 */
const PublicKeyCredentialParametersJSON = z
  .object({
    type: f.publicKeyCredentialType,
    alg: z.number().int().describe('COSE Algorithm Identifier'),
  })
  .describe('Public key credential parameters');

/**
 * AuthenticatorSelectionCriteria schema
 * @see https://w3c.github.io/webauthn/#dictdef-authenticatorselectioncriteria
 */
const AuthenticatorSelectionCriteria = z
  .object({
    authenticatorAttachment: f.authenticatorAttachment.optional(),
    residentKey: z
      .enum(['required', 'preferred', 'discouraged'])
      .optional()
      .describe('Resident key requirement'),
    requireResidentKey: z
      .boolean()
      .optional()
      .describe('Deprecated: use residentKey instead'),
    userVerification: f.userVerificationRequirement.optional(),
  })
  .describe('Authenticator selection criteria');

/**
 * PublicKeyCredentialCreationOptionsJSON schema
 * Used for registration options sent to the browser
 * @see https://w3c.github.io/webauthn/#dictdef-publickeycredentialcreationoptionsjson
 */
const PublicKeyCredentialCreationOptionsJSON = z
  .looseObject({
    rp: PublicKeyCredentialRpEntityJSON,
    user: PublicKeyCredentialUserEntityJSON,
    challenge: f.passkeyChallenge,
    pubKeyCredParams: z.array(PublicKeyCredentialParametersJSON),
    timeout: z.number().int().optional().describe('Timeout in milliseconds'),
    excludeCredentials: z
      .array(PublicKeyCredentialDescriptorJSON)
      .optional()
      .describe('Credentials to exclude'),
    authenticatorSelection: AuthenticatorSelectionCriteria.optional(),
    attestation: z
      .enum(['none', 'indirect', 'direct', 'enterprise'])
      .optional()
      .describe('Attestation conveyance preference'),
    extensions: z.looseObject({}).optional(),
  })
  .describe('WebAuthn registration options');

/**
 * PublicKeyCredentialRequestOptionsJSON schema
 * Used for authentication options sent to the browser
 * @see https://w3c.github.io/webauthn/#dictdef-publickeycredentialrequestoptionsjson
 */
const PublicKeyCredentialRequestOptionsJSON = z
  .looseObject({
    challenge: f.passkeyChallenge,
    timeout: z.number().int().optional().describe('Timeout in milliseconds'),
    rpId: z.string().optional().describe('Relying Party identifier'),
    allowCredentials: z
      .array(PublicKeyCredentialDescriptorJSON)
      .optional()
      .describe('Allowed credentials'),
    userVerification: f.userVerificationRequirement.optional(),
    hints: z.array(f.publicKeyCredentialHint).optional(),
    extensions: z.looseObject({}).optional(),
  })
  .describe('WebAuthn authentication options');

/**
 * AuthenticatorAttestationResponseJSON schema
 * @see https://w3c.github.io/webauthn/#dictdef-authenticatorattestationresponsejson
 */
const AuthenticatorAttestationResponseJSON = z
  .looseObject({
    clientDataJSON: f.base64UrlString,
    attestationObject: f.base64UrlString,
    transports: z
      .array(f.authenticatorTransport)
      .optional()
      .describe('Authenticator transport hints'),
    publicKeyAlgorithm: z
      .number()
      .int()
      .optional()
      .describe('COSE public key algorithm identifier'),
    publicKey: f.base64UrlString
      .optional()
      .describe('Authenticator public key (Base64URL)'),
    authenticatorData: f.base64UrlString
      .optional()
      .describe('Authenticator data (Base64URL)'),
  })
  .describe('Authenticator attestation response');

/**
 * RegistrationResponseJSON schema
 * Sent from browser after navigator.credentials.create()
 * @see https://w3c.github.io/webauthn/#dictdef-registrationresponsejson
 */
const RegistrationResponseJSON = z
  .looseObject({
    id: f.passkeyCredentialId,
    rawId: f.base64UrlString,
    response: AuthenticatorAttestationResponseJSON,
    authenticatorAttachment: f.authenticatorAttachment.optional(),
    clientExtensionResults: z
      .record(z.string(), z.unknown())
      .describe('Client extension results'),
    type: f.publicKeyCredentialType,
  })
  .describe('WebAuthn registration response');

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
    clientExtensionResults: z
      .record(z.string(), z.unknown())
      .describe('Client extension results'),
    type: f.publicKeyCredentialType,
  })
  .describe('WebAuthn authentication response');

// Basic authentication methods response schema (fixed structure)
const PublicPasswordAuth = z
  .object({
    enabled: PasswordAuthConfigSchema.shape.enabled,
    email_verification: PasswordAuthConfigSchema.shape.email_verification,
    second_factor: PasswordAuthConfigSchema.shape.second_factor,
    totp: PasswordAuthConfigSchema.shape.totp,
    policy: PasswordPolicyConfigSchema.describe('Password policy settings'),
  })
  .describe('Public password authentication settings');

const BasicAuthenticationMethods = z
  .object({
    password: PublicPasswordAuth,
    passkey: PasskeyAuthConfigSchema.describe(
      'Passkey authentication settings',
    ),
  })
  .describe('Basic Authentication Methods');

// OAuth authentication method response schema (only enabled providers are returned)
const OAuthAuthenticationMethod = z
  .object({
    id: z.string().describe('Provider identifier'),
    type: z
      .enum(['github', 'google', 'apple', 'generic_oauth'])
      .describe('Provider type'),
    display_name: z.string().describe('Provider display name'),
    icon_url: z.url().optional().describe('Provider icon URL'),
  })
  .describe('OAuth Authentication Method');

export const r = {
  // Base schemas
  UserSession,
  OAuthClient,
  ConsentClient,
  ConsentScope,
  ConsentUser,
  LinkedOAuthAccount,
  AvailableOAuthProvider,
  OAuthAuthenticationMethod,
  BasicAuthenticationMethods,

  // WebAuthn/Passkey schemas
  PublicKeyCredentialDescriptorJSON,
  PublicKeyCredentialRpEntityJSON,
  PublicKeyCredentialUserEntityJSON,
  PublicKeyCredentialParametersJSON,
  AuthenticatorSelectionCriteria,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  AuthenticatorAttestationResponseJSON,
  RegistrationResponseJSON,
  AuthenticatorAssertionResponseJSON,
  AuthenticationResponseJSON,

  // Generic responses
  OAuthError,
  MessageResponse,
  OkResponse,
  RedirectUrlResponse,

  // Simple user session response (for endpoints with no special states)
  UserSessionResponse: z
    .object({
      user: UserSession.describe('Authenticated user session'),
    })
    .describe('User session response'),

  // Unified auth response - discriminated union by status field
  // Combines login, register, email verify, and session responses
  // Note: user info is only provided when status is 'authenticated'
  AuthResponse: z
    .object({
      user: UserSession.describe('Authenticated user session'),
    })
    .describe('Authentication response'),

  OAuthCallbackResponse: z
    .object({
      user: UserSession.describe('Authenticated user session'),
      is_new_user: z
        .boolean()
        .describe('Whether this callback created a new user account'),
      return_url: z
        .string()
        .optional()
        .describe('Optional return URL after OAuth flow completion'),
    })
    .describe('OAuth callback response'),

  ConsentInfoResponse: z
    .object({
      client: ConsentClient.describe('OAuth client requesting consent'),
      scopes: z.array(ConsentScope).describe('Requested OAuth scopes'),
      user: ConsentUser.describe('Current user providing consent'),
    })
    .describe('Consent page information'),

  LinkedAccountsResponse: z
    .object({
      accounts: z
        .array(LinkedOAuthAccount)
        .describe('OAuth accounts currently linked to the user'),
      available_providers: z
        .array(AvailableOAuthProvider)
        .describe('Configured providers with linked state'),
    })
    .describe('Linked OAuth accounts response'),

  // Token response (RFC 6749) - re-export from oauth schema
  TokenResponse: oauthSchema.TokenResponse,

  // Introspection response (RFC 7662) - re-export from oauth schema
  IntrospectionResponse: oauthSchema.TokenIntrospectionResult,

  // UserInfo response (OIDC Core)
  UserInfoResponse: z.object({
    sub: f.userSub.describe('Subject identifier'),
    email: z.email().optional().describe('User email address'),
    email_verified: z
      .boolean()
      .optional()
      .describe('Whether the email address is verified'),
    name: z.string().optional().describe('Display name'),
    picture: z.url().optional().describe('Profile picture URL'),
    preferred_username: z.string().optional().describe('Preferred username'),
  }),

  // Health check response
  HealthResponse: z.object({
    status: z.literal('ok').describe('Overall health status'),
    uptime: z.number().describe('Uptime in seconds'),
    checks: z.object({
      database: z.literal('ok').describe('Database health status'),
    }),
  }),

  HealthErrorResponse: z.object({
    status: z.literal('error').describe('Overall health status'),
    uptime: z.number().describe('Uptime in seconds'),
    checks: z.object({
      database: z.enum(['ok', 'error']).describe('Database health status'),
    }),
    error: z.string().optional().describe('Optional failure reason'),
  }),

  // Liveness probe response
  LivenessResponse: z.object({
    status: z.literal('ok').describe('Liveness status'),
  }),

  // Readiness probe response
  ReadinessResponse: z.object({
    status: z.literal('ok').describe('Readiness status'),
    checks: z.object({
      database: z.literal('ok').describe('Database readiness status'),
    }),
  }),

  ReadinessErrorResponse: z.object({
    status: z.literal('error').describe('Readiness status'),
    checks: z.object({
      database: z.enum(['ok', 'error']).describe('Database readiness status'),
    }),
    error: z.string().optional().describe('Optional failure reason'),
  }),

  // TOTP responses
  TotpSetupResponse: z.object({
    secret: z.string().describe('TOTP secret key (base32 encoded)'),
    otpauth_url: z.string().describe('OTPAuth URL for authenticator apps'),
    qr_code: z.string().describe('QR code as data URL'),
  }),

  TotpSetupVerifyResponse: z.object({
    user: UserSession,
    recovery_codes: z
      .array(z.string())
      .describe('One-time recovery codes (shown only once, store securely)'),
  }),

  RecoveryCodesResponse: z.object({
    recovery_codes: z
      .array(z.string())
      .describe('One-time recovery codes (shown only once, store securely)'),
  }),

  PasskeySetupVerifyResponse: z.object({
    ok: z.literal(true).describe('Whether passkey verification succeeded'),
    user: UserSession.optional().describe(
      'User session if passkey setup was completed from pending setup state',
    ),
    second_factor_setup_completed: z
      .boolean()
      .describe('Whether this request completed the mandatory 2FA setup flow'),
  }),

  // Passkey info schema
  PasskeyInfo: z
    .object({
      id: f.uuid.describe('Passkey record UUID'),
      credential_id: f.passkeyCredentialId.describe('Passkey credential ID'),
      name: z.string().nullable().describe('User-defined passkey name'),
      device_type: f.passkeyDeviceType,
      backed_up: z
        .boolean()
        .describe('Whether the credential is synced/backed up'),
      created_at: z.iso
        .datetime()
        .describe('Timestamp when the passkey was created'),
    })
    .describe('Passkey information'),

  // Passkey responses
  // WebAuthn option/response objects are opaque JSON blobs validated
  // by @simplewebauthn at runtime, so we use z.record() to produce a
  // valid JSON Schema while keeping the types via type assertions in
  // route handlers.
  PasskeyRegistrationOptionsResponse: z.object({
    options: z
      .record(z.string(), z.any())
      .describe('WebAuthn registration options'),
  }),

  PasskeyAuthenticationOptionsResponse: z.object({
    options: z
      .record(z.string(), z.any())
      .describe('WebAuthn authentication options'),
  }),

  // For request body validation, check basic structure.
  // Actual WebAuthn cryptographic validation is done by @simplewebauthn.
  // We validate the minimal shape here so malformed payloads get a clean
  // 400 instead of an unhandled 500 from the library.
  // We use z.record() for JSON Schema compatibility, plus .refine() for
  // runtime structural checks.
  // For request body validation, check basic structure.
  // Actual WebAuthn cryptographic validation is done by @simplewebauthn.
  // We validate the minimal shape here so malformed payloads get a clean
  // 400 instead of an unhandled 500 from the library.
  // We use z.record() for JSON Schema compatibility, plus .refine() for
  // runtime structural checks.
  PasskeyRegistrationBody: z.object({
    response: z
      .record(z.string(), z.any())
      .check(
        z.refine(
          (val): boolean => {
            if (typeof val !== 'object' || val === null) return false;
            if (!('id' in val) || !('rawId' in val) || !('type' in val))
              return false;
            if (val['type'] !== 'public-key') return false;
            if (!('response' in val)) return false;
            const response = val['response'];
            if (typeof response !== 'object' || response === null) return false;
            if (
              !('clientDataJSON' in response) ||
              !('attestationObject' in response)
            )
              return false;
            return true;
          },
          { error: 'Invalid WebAuthn registration response structure' },
        ),
      )
      .describe('WebAuthn registration response'),
    name: f.passkeyName.optional().describe('Optional name for the passkey'),
  }),

  // App config response
  ConfigResponse: z.object({
    app: z.object({
      public_registration: z
        .boolean()
        .describe('Whether public self-registration is enabled'),
      supported_languages: z
        .array(z.string().min(2))
        .describe('Languages enabled for this deployment'),
      default_language: z.string().describe('Default UI language'),
      fallback_language: z.string().describe('Fallback UI language'),
      light_theme: AppThemeSchema.describe('Theme preset used in light mode'),
      dark_theme: AppThemeSchema.describe('Theme preset used in dark mode'),
      theme_mode: z
        .enum(['light', 'dark', 'system'])
        .describe('Theme mode strategy'),
      background_url: z.url().optional().describe('Background image URL'),
      signup_implicit_terms: z
        .record(z.string(), z.string())
        .optional()
        .describe('Localized notice text for implicit consent terms'),
      icon_url: z
        .url()
        .optional()
        .describe('Icon/logo URL displayed on authentication pages'),
      title: z
        .record(z.string(), z.string())
        .optional()
        .describe('Localized title text for login page'),
      subtitle: z
        .record(z.string(), z.string())
        .optional()
        .describe('Localized subtitle text for login page'),
    }),
    database: z.object({
      enabled: z
        .boolean()
        .describe('Whether database-backed features are enabled'),
    }),
    smtp: z.object({
      enabled: z.boolean().describe('Whether SMTP email delivery is enabled'),
    }),
    auth: BasicAuthenticationMethods.describe('Enabled authentication methods'),
    identity_providers: z
      .array(OAuthAuthenticationMethod)
      .describe('Enabled external identity providers'),
    account_deletion: z.object({
      enabled: z.boolean().describe('Whether account deletion is enabled'),
      retention_period: z
        .string()
        .describe('Data retention period after deletion request'),
    }),
  }),

  // Account deletion response
  AccountDeletionResponse: z.object({
    ok: z.literal(true),
    deleted_at: z
      .string()
      .datetime()
      .describe('Timestamp when deletion was requested'),
    permanent_deletion_at: z
      .string()
      .datetime()
      .describe('Timestamp when permanent deletion will occur'),
  }),
};

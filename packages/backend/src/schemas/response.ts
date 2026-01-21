import {
  AppConfigPasskeyAuth,
  AppConfigPasswordAuth,
  AppTheme,
} from '@/lib/config/index.js';
import type {
  PublicKeyCredentialCreationOptionsJSON as SimpleWebAuthnCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON as SimpleWebAuthnRequestOptionsJSON,
  RegistrationResponseJSON as SimpleWebAuthnRegistrationResponseJSON,
} from '@simplewebauthn/server';
import z from 'zod/v4';
import { f } from './field.js';
import { oauthSchema } from './oauth.js';

// Base schemas
const UserSession = z
  .object({
    managed_by: z.literal(['database', 'config']),
    id: f.userId,
    email: f.userEmail,
    email_verified: f.emailVerified,
    email_verification_required: z
      .boolean()
      .describe('Whether email verification is required for the user'),
    has_password: z.boolean().describe('Whether the user has a password set'),
    totp_registered: z
      .boolean()
      .describe('Whether TOTP is registered for the user'),
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
    id: z.string(),
    clientId: z.string(),
    name: z.string(),
    managed_by: z.enum(['config', 'database']),
    enabled: z.boolean(),
    redirectUris: z.array(z.string()),
    responseTypes: z.array(z.string()),
    scopes: z.array(z.string()),
    grantTypes: z.array(z.string()),
  })
  .describe('OAuth Client Information');

const OAuthProvider = z
  .object({
    id: z.string(),
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
    id: z.string(),
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
    transports: z.array(f.authenticatorTransport).optional(),
    publicKeyAlgorithm: z.number().int().optional(),
    publicKey: f.base64UrlString.optional(),
    authenticatorData: f.base64UrlString.optional(),
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
    clientExtensionResults: z.record(z.string(), z.unknown()),
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
    clientExtensionResults: z.record(z.string(), z.unknown()),
    type: f.publicKeyCredentialType,
  })
  .describe('WebAuthn authentication response');

// Basic authentication methods response schema (fixed structure)
const BasicAuthenticationMethods = z
  .object({
    password: AppConfigPasswordAuth,
    passkey: AppConfigPasskeyAuth,
  })
  .describe('Basic Authentication Methods');

// OAuth authentication method response schema
const OAuthAuthenticationMethod = z
  .object({
    id: z.string(),
    type: z.enum(['github', 'google', 'apple', 'generic_oauth']),
    enabled: z.boolean(),
    display_name: z.string().optional(),
    icon_url: z.string().optional(),
  })
  .describe('OAuth Authentication Method');

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
  GenericError,
  OAuthError,
  MessageResponse,
  SuccessResponse,
  OkResponse,
  RedirectUrlResponse,

  // Simple user session response (for endpoints with no special states)
  UserSessionResponse: z.object({
    user: UserSession,
  }),

  // Unified auth response - discriminated union by status field
  // Combines login, register, email verify, and session responses
  // Note: user info is only provided when status is 'authenticated'
  AuthResponse: z.object({
    user: UserSession,
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

  // Token response (RFC 6749) - re-export from oauth schema
  TokenResponse: oauthSchema.TokenResponse,

  // Introspection response (RFC 7662) - re-export from oauth schema
  IntrospectionResponse: oauthSchema.TokenIntrospectionResult,

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

  PasskeySetupVerifyResponse: z.object({
    success: z.boolean(),
    user: UserSession.optional().describe(
      'User session if passkey setup was completed from pending setup state',
    ),
    second_factor_setup_completed: z
      .boolean()
      .describe('Whether this request completed the mandatory 2FA setup flow'),
  }),

  // Passkey responses
  // Use z.custom to maintain type compatibility with @simplewebauthn types
  // Actual validation is done by @simplewebauthn library, not Zod
  PasskeyRegistrationOptionsResponse: z.object({
    options: z.custom<SimpleWebAuthnCreationOptionsJSON>(() => true),
  }),

  PasskeyAuthenticationOptionsResponse: z.object({
    options: z.custom<SimpleWebAuthnRequestOptionsJSON>(() => true),
  }),

  // For request body validation, check basic structure
  // Actual WebAuthn validation is done by @simplewebauthn library
  PasskeyRegistrationBody: z.object({
    response: z.custom<SimpleWebAuthnRegistrationResponseJSON>((val) => {
      if (typeof val !== 'object' || val === null) return false;
      if (!('id' in val) || !('rawId' in val) || !('type' in val)) return false;
      if (val.type !== 'public-key') return false;
      if (!('response' in val)) return false;
      const response = val.response;
      if (typeof response !== 'object' || response === null) return false;
      if (!('clientDataJSON' in response) || !('attestationObject' in response))
        return false;
      return true;
    }),
    name: z
      .string()
      .max(100)
      .optional()
      .describe('Optional name for the passkey'),
  }),

  // App config response
  ConfigResponse: z.object({
    app: z.object({
      public_registration: z.boolean(),
      supported_languages: z.array(z.string()),
      default_language: z.string(),
      fallback_language: z.string(),
      light_theme: AppTheme,
      dark_theme: AppTheme,
      theme_mode: z.enum(['light', 'dark', 'system']),
      background_url: z.string().url().optional(),
    }),
    database: z.object({
      enabled: z.boolean(),
    }),
    basic_authentication_methods: BasicAuthenticationMethods,
    oauth_authentication_methods: z.array(OAuthAuthenticationMethod),
    account_deletion: z.object({
      enabled: z.boolean().describe('Whether account deletion is enabled'),
      retention_period: z
        .string()
        .describe('Data retention period after deletion request'),
    }),
  }),

  // Account deletion response
  AccountDeletionResponse: z.object({
    success: z.literal(true),
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

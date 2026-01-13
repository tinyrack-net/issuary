import z from 'zod/v4';
import { r } from './response.js';

/**
 * OAuth user info returned from provider
 * Normalized user information from external OAuth providers
 */
export const OAuthUserInfo = z
  .object({
    /** Provider's user ID */
    id: z.string(),
    /** User's email address */
    email: z.string(),
    /** Whether the email is verified by the provider */
    email_verified: z.boolean(),
    /** User's display name */
    name: z.string().optional(),
    /** User's profile picture URL */
    picture: z.string().optional(),
  })
  .describe('Normalized user info from OAuth provider');

/**
 * Token response from OAuth provider
 * Standard OAuth 2.0 token response structure
 */
export const OAuthTokens = z
  .object({
    /** OAuth access token */
    access_token: z.string(),
    /** OAuth refresh token (if provided) */
    refresh_token: z.string().optional(),
    /** Token expiration time in seconds */
    expires_in: z.number().optional(),
    /** Token type (usually "Bearer") */
    token_type: z.string(),
    /** OIDC ID token (if openid scope was requested) */
    id_token: z.string().optional(),
  })
  .describe('Token response from OAuth provider');

/**
 * OAuth session data stored in secure session
 * Used to maintain state during OAuth flow
 */
export const OAuthSessionData = z
  .object({
    /** State parameter for CSRF protection */
    state: z.string(),
    /** PKCE code verifier */
    codeVerifier: z.string(),
    /** OAuth provider ID */
    providerId: z.string(),
    /** Authentication mode */
    mode: z.enum(['login', 'register', 'link']),
    /** URL to return to after authentication */
    returnUrl: z.string().optional(),
  })
  .describe('OAuth session data for flow state');

/**
 * Result of OAuth authentication
 * Returned after successful OAuth login/registration
 */
export const OAuthAuthResult = z
  .object({
    /** Whether this is a newly created user */
    isNewUser: z.boolean(),
    /** Authenticated user session data */
    user: r.UserSession,
  })
  .describe('OAuth authentication result');

/**
 * OAuth Connect related schemas namespace
 * Usage: import { oauthConnectSchema } from '@/schemas/oauth-connect.js'
 * Type inference: type OAuthUserInfo = z.infer<typeof oauthConnectSchema.OAuthUserInfo>
 */
export const oauthConnectSchema = {
  OAuthUserInfo,
  OAuthTokens,
  OAuthSessionData,
  OAuthAuthResult,
};

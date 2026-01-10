import { signAccessToken, signIdToken, signRefreshToken } from './jwt.js';

/**
 * Parameters for building OAuth/OIDC token response
 */
export interface TokenBuilderParams {
  /** User ID (sub claim) */
  userId: string;
  /** User email address */
  userEmail: string;
  /** Whether user's email is verified */
  userEmailVerified: boolean;
  /** OAuth client ID (aud claim) */
  clientId: string;
  /** Granted scopes */
  scope: string[];
  /** OIDC nonce for replay protection (optional) */
  nonce?: string;
}

/**
 * OAuth 2.0 / OIDC token response
 * Conforms to RFC 6749 §5.1 and OIDC Core §3.1.3.3
 */
export interface TokenResponse {
  /** JWT access token */
  access_token: string;
  /** Token type (always "Bearer") */
  token_type: 'Bearer';
  /** Access token lifetime in seconds */
  expires_in: number;
  /** JWT refresh token */
  refresh_token: string;
  /** OIDC ID Token (only if openid scope requested) */
  id_token?: string;
  /** Space-delimited granted scopes */
  scope: string;
}

/**
 * Build complete OAuth/OIDC token response
 *
 * Generates access token, refresh token, and optionally ID token
 * based on requested scopes.
 *
 * @param params - Token generation parameters
 * @returns Complete token response ready to send to client
 *
 * @example
 * ```typescript
 * const tokens = await buildTokenResponse({
 *   userId: 'user123',
 *   userEmail: 'user@example.com',
 *   userEmailVerified: true,
 *   clientId: 'client123',
 *   scope: ['openid', 'email', 'profile'],
 *   nonce: 'abc123',
 * });
 * ```
 */
export async function buildTokenResponse(
  params: TokenBuilderParams,
): Promise<TokenResponse> {
  const { userId, userEmail, userEmailVerified, clientId, scope, nonce } =
    params;

  const scopeString = scope.join(' ');

  // Generate access token (RFC 6749 §1.4)
  const accessToken = await signAccessToken({
    typ: 'access_token',
    sub: userId,
    client_id: clientId,
    scope: scopeString,
  });

  // Generate refresh token (RFC 6749 §1.5)
  const refreshToken = await signRefreshToken({
    typ: 'refresh_token',
    sub: userId,
    client_id: clientId,
    scope: scopeString,
  });

  const response: TokenResponse = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600, // 1 hour
    refresh_token: refreshToken,
    scope: scopeString,
  };

  // Generate ID token if OIDC (openid scope present)
  // OIDC Core §2 - ID Token is only issued when openid scope is requested
  if (scope.includes('openid')) {
    const idTokenPayload: {
      sub: string;
      aud: string;
      nonce?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    } = {
      sub: userId,
      aud: clientId,
    };

    // Add nonce for replay protection (OIDC Core §3.1.2.1)
    if (nonce) {
      idTokenPayload.nonce = nonce;
    }

    // Add claims based on scope (OIDC Core §5.4)
    if (scope.includes('email')) {
      idTokenPayload.email = userEmail;
      idTokenPayload.email_verified = userEmailVerified;
    }

    if (scope.includes('profile')) {
      // Use email as name for now (can be extended with actual name field)
      idTokenPayload.name = userEmail;
    }

    response.id_token = await signIdToken(idTokenPayload);
  }

  return response;
}

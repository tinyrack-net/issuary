import fastifyPlugin from 'fastify-plugin';
import {
  type AccessTokenPayload,
  type RefreshTokenPayload,
  decodeToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '@/lib/jwt.js';
import { buildTokenResponse } from '@/lib/oauth-token-builder.js';
import { validatePKCE } from '@/lib/pkce.js';
import type { MikroService } from '@/plugins/mikro-orm.js';
import { e } from '@/schemas/error.js';
import type { OAuthClientService } from './oauth-client.service.js';
import type { UserService } from './user.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    oauthTokenService: OAuthTokenService;
  }
}

/**
 * Parameters for authorization code grant
 * RFC 6749 §4.1.3 - Access Token Request
 */
export interface AuthorizationCodeGrantParams {
  /** Authorization code received from /authorize endpoint */
  code: string;
  /** Redirect URI used in authorization request (must match) */
  redirectUri: string;
  /** OAuth client identifier */
  clientId: string;
  /** PKCE code verifier (required if code_challenge was used) */
  codeVerifier?: string | undefined;
}

/**
 * Parameters for refresh token grant
 * RFC 6749 §6 - Refreshing an Access Token
 */
export interface RefreshTokenGrantParams {
  /** Refresh token from previous token response */
  refreshToken: string;
  /** OAuth client identifier (must match original request) */
  clientId: string;
}

/**
 * Token introspection result
 * RFC 7662 §2.2 - Introspection Response
 */
export interface TokenIntrospectionResult {
  /** Whether the token is currently active */
  active: boolean;
  /** Space-separated list of scopes (only if active) */
  scope?: string;
  /** Client identifier (only if active) */
  client_id?: string;
  /** Type of token (only if active) */
  token_type?: 'Bearer';
  /** Expiration timestamp in seconds (only if active) */
  exp?: number;
  /** Issued-at timestamp in seconds (only if active) */
  iat?: number;
  /** Subject identifier - user ID (only if active) */
  sub?: string;
  /** Issuer identifier (only if active) */
  iss?: string;
}

/**
 * OAuth Token Service
 *
 * Handles OAuth 2.0 token issuance for different grant types:
 * - Authorization Code Grant (RFC 6749 §4.1)
 * - Refresh Token Grant (RFC 6749 §6)
 *
 * Supports both config-based and database-based users/clients.
 */
export class OAuthTokenService {
  constructor(
    private readonly mikro: MikroService,
    private readonly userService: UserService,
    private readonly oauthClientService: OAuthClientService,
  ) {}

  /**
   * Exchange authorization code for tokens
   *
   * Implements OAuth 2.0 Authorization Code Grant (RFC 6749 §4.1.3)
   * with PKCE support (RFC 7636).
   *
   * @param params - Authorization code grant parameters
   * @returns Token response with access_token, refresh_token, and optionally id_token
   * @throws {InvalidAuthorizationCode} - Code is invalid or expired
   * @throws {RedirectUriMismatch} - Redirect URI doesn't match authorization request
   * @throws {MissingCodeVerifier} - PKCE verifier required but not provided
   * @throws {InvalidPKCEVerifier} - PKCE verification failed
   */
  async exchangeAuthorizationCode(params: AuthorizationCodeGrantParams) {
    const { code, redirectUri, clientId, codeVerifier } = params;

    // 1. Verify and consume the authorization code
    // Authorization codes are single-use (RFC 6749 §4.1.2)
    const codeEntity = await this.mikro.oauthCode.verifyAndConsumeCode(
      code,
      clientId,
    );

    if (!codeEntity) {
      throw new e.InvalidAuthorizationCode.Error();
    }

    // 2. Validate redirect_uri matches (RFC 6749 §4.1.3)
    // This prevents authorization code interception attacks
    if (codeEntity.redirectUri !== redirectUri) {
      throw new e.RedirectUriMismatch.Error();
    }

    // 3. Validate PKCE if code_challenge was used (RFC 7636 §4.6)
    // PKCE protects against authorization code interception for public clients
    if (codeEntity.codeChallenge) {
      if (!codeVerifier) {
        throw new e.MissingCodeVerifier.Error();
      }

      const isPKCEValid = await validatePKCE(
        codeVerifier,
        codeEntity.codeChallenge,
        codeEntity.codeChallengeMethod,
      );

      if (!isPKCEValid) {
        throw new e.InvalidPKCEVerifier.Error();
      }
    }

    // 4. Load user (supports both config and DB users)
    const userData = await this.userService.verifyUserById(codeEntity.userId);

    // 5. Get client info (for audience claim)
    const client = await this.oauthClientService.findByClientId(clientId);

    // 6. Build token response
    return buildTokenResponse({
      userId: userData.id,
      userEmail: userData.email,
      userEmailVerified: userData.email_verified,
      clientId: client.clientId,
      scope: codeEntity.scope,
      nonce: codeEntity.nonce,
    });
  }

  /**
   * Refresh access token using refresh token
   *
   * Implements OAuth 2.0 Refresh Token Grant (RFC 6749 §6).
   * Issues new access token and refresh token without user interaction.
   *
   * @param params - Refresh token grant parameters
   * @returns Token response with new access_token and refresh_token
   * @throws {InvalidRefreshToken} - Refresh token is invalid or expired
   * @throws {ClientIdMismatch} - Client ID doesn't match original token request
   */
  async refreshAccessToken(params: RefreshTokenGrantParams) {
    const { refreshToken, clientId } = params;

    // 1. Verify refresh token
    const refreshPayload = await verifyRefreshToken(refreshToken);

    // 2. Validate client_id matches (RFC 6749 §6)
    // Refresh token is bound to the client that obtained it
    if (refreshPayload.client_id !== clientId) {
      throw new e.ClientIdMismatch.Error();
    }

    // 3. Load user (supports both config and DB users)
    const userData = await this.userService.verifyUserById(refreshPayload.sub);

    // 4. Get client info
    const client = await this.oauthClientService.findByClientId(clientId);

    // 5. Build token response (no nonce in refresh flow)
    return buildTokenResponse({
      userId: userData.id,
      userEmail: userData.email,
      userEmailVerified: userData.email_verified,
      clientId: client.clientId,
      scope: refreshPayload.scope.split(' '),
    });
  }

  /**
   * Introspect a token (access token or refresh token)
   *
   * Implements OAuth 2.0 Token Introspection (RFC 7662).
   * Returns metadata about the token including active status.
   *
   * @param token - Token to introspect
   * @param tokenTypeHint - Hint about token type (access_token or refresh_token)
   * @returns Token introspection result
   */
  async introspectToken(
    token: string,
    tokenTypeHint?: 'access_token' | 'refresh_token',
  ): Promise<TokenIntrospectionResult> {
    // Try to verify the token based on hint or both types
    let payload: AccessTokenPayload | RefreshTokenPayload | null = null;
    let tokenType: 'access_token' | 'refresh_token' | null = null;

    // 1. Try to verify as hinted token type first (if hint provided)
    if (tokenTypeHint === 'access_token') {
      try {
        payload = await verifyAccessToken(token);
        tokenType = 'access_token';
      } catch {
        // Hint failed, try refresh token
        try {
          payload = await verifyRefreshToken(token);
          tokenType = 'refresh_token';
        } catch {
          // Both failed, fall through to inactive
        }
      }
    } else if (tokenTypeHint === 'refresh_token') {
      try {
        payload = await verifyRefreshToken(token);
        tokenType = 'refresh_token';
      } catch {
        // Hint failed, try access token
        try {
          payload = await verifyAccessToken(token);
          tokenType = 'access_token';
        } catch {
          // Both failed, fall through to inactive
        }
      }
    } else {
      // 2. No hint provided, try both types
      try {
        payload = await verifyAccessToken(token);
        tokenType = 'access_token';
      } catch {
        try {
          payload = await verifyRefreshToken(token);
          tokenType = 'refresh_token';
        } catch {
          // Both failed, fall through to inactive
        }
      }
    }

    // 3. If verification succeeded, return active response
    if (payload && tokenType) {
      return {
        active: true,
        scope: payload.scope,
        client_id: payload.client_id,
        token_type: 'Bearer',
        ...(payload.exp !== undefined && { exp: payload.exp }),
        ...(payload.iat !== undefined && { iat: payload.iat }),
        sub: payload.sub,
        ...(payload.iss !== undefined && { iss: payload.iss }),
      };
    }

    // 4. Token is invalid or expired - return inactive
    // RFC 7662 §2.2: "If the token is not active, does not exist on this server,
    // or the protected resource is not allowed to introspect this particular token,
    // then the authorization server MUST return an introspection response with
    // the active field set to false"
    return {
      active: false,
    };
  }
}

export default fastifyPlugin(
  async (fastify) => {
    fastify.decorate(
      'oauthTokenService',
      new OAuthTokenService(
        fastify.mikro,
        fastify.userService,
        fastify.oauthClientService,
      ),
    );
  },
  {
    name: 'oauth-token-service-plugin',
    dependencies: [
      'mikro-orm-plugin',
      'user-service-plugin',
      'oauth-client-service-plugin',
    ],
  },
);

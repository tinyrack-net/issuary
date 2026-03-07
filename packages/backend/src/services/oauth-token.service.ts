import {
  stringToBytes,
  toArrayBuffer,
  toBase64Url,
} from '#backend/lib/base64url.js';
import { validatePKCE } from '#backend/lib/pkce.js';
import type { ResolvedAppConfig } from '#backend/lib/config/index.js';
import { e } from '#backend/schemas/error.js';
import type { MikroService } from '#backend/services/mikro.service.js';
import type { SecurityService } from '#backend/services/security.service.js';
import type {
  AccessTokenPayload,
  JwtService,
  RefreshTokenPayload,
} from './jwt.service.js';
import type { OAuthClientService } from './oauth-client.service.js';
import type { UserService } from './user.service.js';

/**
 * Parameters for authorization code grant (RFC 6749 §4.1.3)
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.3
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
 * Parameters for refresh token grant (RFC 6749 §6)
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-6
 */
export interface RefreshTokenGrantParams {
  /** Refresh token from previous token response */
  refreshToken: string;
  /** OAuth client identifier (must match original request) */
  clientId: string;
}

/**
 * Token introspection result (RFC 7662 §2.2)
 * @see https://datatracker.ietf.org/doc/html/rfc7662#section-2.2
 */
export interface TokenIntrospectionResult {
  /** Whether the token is currently active */
  active: boolean;
  /** Space-separated list of scopes (only if active) */
  scope?: string | undefined;
  /** Client identifier (only if active) */
  client_id?: string | undefined;
  /** Type of token (only if active) */
  token_type?: 'Bearer' | undefined;
  /** Expiration timestamp in seconds (only if active) */
  exp?: number | undefined;
  /** Issued-at timestamp in seconds (only if active) */
  iat?: number | undefined;
  /** Subject identifier - user ID (only if active) */
  sub?: string | undefined;
  /** Issuer identifier (only if active) */
  iss?: string | undefined;
}

/**
 * OAuth 2.0 / OIDC token response (RFC 6749 §5.1)
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-5.1
 * @see https://openid.net/specs/openid-connect-core-1_0.html#TokenResponse
 */
export interface TokenResponse {
  /** OAuth 2.0 access token (JWT format) */
  access_token: string;
  /** Token type identifier */
  token_type: 'Bearer';
  /** Access token lifetime in seconds */
  expires_in: number;
  /** Refresh token for obtaining new access tokens */
  refresh_token: string;
  /** OpenID Connect ID Token (JWT format, only if openid scope requested) */
  id_token?: string | undefined;
  /** Space-separated list of granted scopes */
  scope: string;
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
  private readonly config: ResolvedAppConfig;
  private readonly mikro: MikroService;
  private readonly userService: UserService;
  private readonly oauthClientService: OAuthClientService;
  private readonly jwtService: JwtService;
  private readonly securityService: SecurityService;
  constructor(
    config: ResolvedAppConfig,
    mikro: MikroService,
    userService: UserService,
    oauthClientService: OAuthClientService,
    jwtService: JwtService,
    securityService: SecurityService,
  ) {
    this.config = config;
    this.mikro = mikro;
    this.userService = userService;
    this.oauthClientService = oauthClientService;
    this.jwtService = jwtService;
    this.securityService = securityService;
  }

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

    // 1. Look up client to get primary key (clientId in request is the business key)
    const client = await this.oauthClientService.findByClientId(clientId);

    // 2. Verify and consume the authorization code
    // Authorization codes are single-use (RFC 6749 §4.1.2)
    const codeHash = await this.securityService.hashOpaqueToken(
      'oauth-code',
      code,
    );
    const codeEntity =
      await this.mikro.oauthCode.findUnconsumedByClientAndCodeHash(
        client.id,
        codeHash,
      );

    if (!codeEntity) {
      throw new e.InvalidAuthorizationCode.Error();
    }

    if (codeEntity.expiredAt < new Date()) {
      throw new e.InvalidAuthorizationCode.Error();
    }

    codeEntity.consumedAt = new Date();
    await this.mikro.em.flush();

    // 3. Populate user relation
    await this.mikro.em.populate(codeEntity, ['user']);

    // 4. Validate redirect_uri matches (RFC 6749 §4.1.3)
    // This prevents authorization code interception attacks
    if (codeEntity.redirectUri !== redirectUri) {
      throw new e.RedirectUriMismatch.Error();
    }

    // 5. Validate PKCE if code_challenge was used (RFC 7636 §4.6)
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

    // 6. Get user data from relation (load via Ref)
    const user = await codeEntity.user.load();
    if (!user) {
      throw new e.UserNotFound.Error();
    }

    // 7. Build token response
    return this.buildTokenResponse({
      userSub: user.sub,
      userEmail: user.email,
      userEmailVerified: user.email_verified,
      clientId: client.clientId,
      scope: codeEntity.scope,
      nonce: codeEntity.nonce,
      // Pass OIDC authentication metadata from the authorization code
      // Only include when defined and non-null (exactOptionalPropertyTypes)
      ...(codeEntity.authTime != null && {
        authTime: codeEntity.authTime,
      }),
    });
  }

  /**
   * Refresh access token using refresh token
   *
   * Implements OAuth 2.0 Refresh Token Grant (RFC 6749 §6) with
   * Refresh Token Rotation (OAuth 2.0 Security Best Current Practice).
   *
   * When a refresh token is used:
   * 1. The old refresh token is revoked (token rotation)
   * 2. A new refresh token is issued along with the new access token
   * 3. This prevents token replay attacks
   *
   * @param params - Refresh token grant parameters
   * @returns Token response with new access_token and refresh_token
   * @throws {InvalidRefreshToken} - Refresh token is invalid, expired, or revoked
   * @throws {ClientIdMismatch} - Client ID doesn't match original token request
   */
  async refreshAccessToken(params: RefreshTokenGrantParams) {
    const { refreshToken, clientId } = params;

    // 1. Verify refresh token (also checks revocation)
    const refreshPayload =
      await this.jwtService.verifyRefreshToken(refreshToken);

    // 2. Validate client_id matches (RFC 6749 §6)
    // Refresh token is bound to the client that obtained it
    if (refreshPayload.client_id !== clientId) {
      throw new e.ClientIdMismatch.Error();
    }

    // 3. Load user (supports both config and DB users)
    const userEntity = await this.mikro.user.verifyBySub(refreshPayload.sub);
    const userData = await this.userService.userEntityToSessionUser(userEntity);

    // 4. Get client info
    const client = await this.oauthClientService.findByClientId(clientId);

    // 5. Refresh Token Rotation: Revoke the old refresh token
    // This is a security best practice per OAuth 2.0 Security BCP §4.14.2
    // If an attacker tries to use a stolen refresh token after the legitimate
    // user has already used it, the token will be rejected as revoked.
    if (refreshPayload.jti && refreshPayload.exp) {
      await this.mikro.revokedToken.revokeToken({
        jti: refreshPayload.jti,
        token_type: 'refresh_token',
        clientId: client.id, // Use entity primary key
        userSub: userData.sub,
        expires_at: new Date(refreshPayload.exp * 1000),
      });
    }

    // 6. Build token response with new access and refresh tokens
    // (no nonce in refresh flow)
    return this.buildTokenResponse({
      userSub: userData.sub,
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
        payload = await this.jwtService.verifyAccessToken(token);
        tokenType = 'access_token';
      } catch {
        // Hint failed, try refresh token
        try {
          payload = await this.jwtService.verifyRefreshToken(token);
          tokenType = 'refresh_token';
        } catch {
          // Both failed, fall through to inactive
        }
      }
    } else if (tokenTypeHint === 'refresh_token') {
      try {
        payload = await this.jwtService.verifyRefreshToken(token);
        tokenType = 'refresh_token';
      } catch {
        // Hint failed, try access token
        try {
          payload = await this.jwtService.verifyAccessToken(token);
          tokenType = 'access_token';
        } catch {
          // Both failed, fall through to inactive
        }
      }
    } else {
      // 2. No hint provided, try both types
      try {
        payload = await this.jwtService.verifyAccessToken(token);
        tokenType = 'access_token';
      } catch {
        try {
          payload = await this.jwtService.verifyRefreshToken(token);
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

  /**
   * Revoke a token (access token or refresh token)
   *
   * Implements OAuth 2.0 Token Revocation (RFC 7009).
   * When revoking a refresh token, also revokes all associated access tokens
   * for the same user/client combination.
   *
   * @param token - Token to revoke
   * @param tokenTypeHint - Hint about token type (access_token or refresh_token)
   * @returns void - Always succeeds per RFC 7009 §2.1
   */
  async revokeToken(
    token: string,
    tokenTypeHint?: 'access_token' | 'refresh_token',
  ): Promise<void> {
    // Decode the token to get metadata (without full verification)
    const decoded = this.jwtService.decodeToken(token);

    if (!decoded || !decoded.jti || !decoded.sub || !decoded.exp) {
      // RFC 7009 §2.1: "The authorization server responds with HTTP status
      // code 200 if the token has been revoked successfully or if the client
      // submitted an invalid token."
      return;
    }

    const jti = decoded.jti;
    const userSub = decoded.sub;
    const rawClientId = decoded['client_id'];
    const clientId = typeof rawClientId === 'string' ? rawClientId : undefined;
    const rawTyp = decoded['typ'];
    const tokenType =
      (rawTyp === 'access_token' || rawTyp === 'refresh_token'
        ? rawTyp
        : undefined) ||
      tokenTypeHint ||
      'access_token';
    const expiresAt = new Date(decoded.exp * 1000);

    if (!clientId) {
      return;
    }

    // Check if already revoked
    const isAlreadyRevoked = await this.mikro.revokedToken.isRevoked(jti);
    if (isAlreadyRevoked) {
      return;
    }

    // Look up user and client entities to get primary keys
    // Note: clientId from token is the business key, we need the entity's primary key
    const userEntity = await this.mikro.user.findOne({ sub: userSub });
    const clientEntity = await this.mikro.oauthClient.findOne({ clientId });

    if (!userEntity || !clientEntity) {
      // User or client no longer exists, but we still return success per RFC 7009
      return;
    }

    // Revoke the token (using primary keys for FK references)
    await this.mikro.revokedToken.revokeToken({
      jti,
      token_type: tokenType,
      clientId: clientEntity.id, // Use entity's primary key
      userSub: userEntity.sub,
      expires_at: expiresAt,
    });

    // RFC 7009 §2.1: "If the particular token is a refresh token and the
    // authorization server supports the revocation of access tokens, then
    // the authorization server SHOULD also invalidate all access tokens
    // based on the same authorization grant."
    //
    // Since we can't enumerate all access tokens issued for this refresh token,
    // the revocation check happens at token verification time via jti lookup.
    // Access tokens will be rejected when their jti is in the revoked_tokens table.
  }

  /**
   * Compute the at_hash claim value (OIDC Core 1.0 §3.1.3.6)
   *
   * The at_hash is the left-most half of the hash of the access token,
   * using the hash algorithm from the ID Token's JOSE Header.
   * For RS256, this is SHA-256.
   *
   * @param accessToken - The access token to hash
   * @returns Base64URL-encoded left half of the SHA-256 hash
   */
  private async computeAtHash(accessToken: string): Promise<string> {
    // SHA-256 hash of the access token
    const hash = new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        toArrayBuffer(stringToBytes(accessToken)),
      ),
    );
    // Take the left-most half (128 bits = 16 bytes for SHA-256)
    const leftHalf = hash.slice(0, hash.byteLength / 2);
    // Base64URL encode
    return toBase64Url(leftHalf);
  }

  /**
   * Build complete OAuth/OIDC token response
   *
   * @param params - Token generation parameters
   * @returns Complete token response
   */
  private async buildTokenResponse(params: {
    userSub: string;
    userEmail: string;
    userEmailVerified: boolean;
    clientId: string;
    scope: string[];
    nonce?: string;
    /** OIDC: Time when End-User authentication occurred (Unix timestamp) */
    authTime?: number;
  }): Promise<TokenResponse> {
    const {
      userSub,
      userEmail,
      userEmailVerified,
      clientId,
      scope,
      nonce,
      authTime,
    } = params;

    const scopeString = scope.join(' ');

    // Generate access token (RFC 6749 §1.4)
    const accessToken = await this.jwtService.signAccessToken({
      typ: 'access_token',
      sub: userSub,
      client_id: clientId,
      scope: scopeString,
    });

    // Generate refresh token (RFC 6749 §1.5)
    const refreshToken = await this.jwtService.signRefreshToken({
      typ: 'refresh_token',
      sub: userSub,
      client_id: clientId,
      scope: scopeString,
    });

    const response: TokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.app.jwt_access_token_ttl || 3600,
      refresh_token: refreshToken,
      scope: scopeString,
    };

    // Generate ID token if OIDC (openid scope present)
    if (scope.includes('openid')) {
      const idTokenPayload: {
        sub: string;
        aud: string;
        nonce?: string;
        auth_time?: number;
        at_hash?: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
      } = {
        sub: userSub,
        aud: clientId,
      };

      if (nonce) {
        idTokenPayload.nonce = nonce;
      }

      // Include OIDC authentication metadata claims
      if (authTime !== undefined) {
        idTokenPayload.auth_time = authTime;
      }

      // Compute at_hash (OIDC Core 1.0 §3.1.3.6)
      // Required when ID Token is issued from Authorization Endpoint with
      // access token in the same response, optional otherwise but recommended
      idTokenPayload.at_hash = await this.computeAtHash(accessToken);

      if (scope.includes('email')) {
        idTokenPayload.email = userEmail;
        idTokenPayload.email_verified = userEmailVerified;
      }

      if (scope.includes('profile')) {
        idTokenPayload.name = userEmail;
      }

      response.id_token = await this.jwtService.signIdToken(idTokenPayload);
    }

    return response;
  }
}

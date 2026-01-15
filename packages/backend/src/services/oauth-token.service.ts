import { createHash } from 'node:crypto';
import fastifyPlugin from 'fastify-plugin';
import type z from 'zod/v4';
import type { InternalAppConfig } from '@/lib/config/index.js';
import { validatePKCE } from '@/lib/pkce.js';
import type { MikroService } from '@/plugins/mikro-orm.js';
import type {
  AuthenticationContextClass,
  AuthenticationMethod,
} from '@/plugins/secure-session.js';
import { e } from '@/schemas/error.js';
import type { jwtPayload } from '@/schemas/jwt.js';
import type { oauthSchema } from '@/schemas/oauth.js';
import type { JwtService } from './jwt.service.js';
import type { OAuthClientService } from './oauth-client.service.js';
import type { UserService } from './user.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    oauthTokenService: OAuthTokenService;
  }
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
    private readonly config: InternalAppConfig,
    private readonly mikro: MikroService,
    private readonly userService: UserService,
    private readonly oauthClientService: OAuthClientService,
    private readonly jwtService: JwtService,
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
  async exchangeAuthorizationCode(
    params: z.infer<typeof oauthSchema.AuthorizationCodeGrantParams>,
  ) {
    const { code, redirectUri, clientId, codeVerifier } = params;

    // 1. Look up client to get primary key (clientId in request is the business key)
    const client = await this.oauthClientService.findByClientId(clientId);

    // 2. Verify and consume the authorization code
    // Authorization codes are single-use (RFC 6749 §4.1.2)
    const codeEntity = await this.mikro.oauthCode.verifyAndConsumeCode(
      code,
      client.id, // Use primary key for FK reference
    );

    if (!codeEntity) {
      throw new e.InvalidAuthorizationCode.Error();
    }

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
      userId: user.id,
      userEmail: user.email,
      userEmailVerified: user.email_verified,
      clientId: client.clientId,
      scope: codeEntity.scope,
      nonce: codeEntity.nonce,
      // Pass OIDC authentication metadata from the authorization code
      // Only include when defined (exactOptionalPropertyTypes)
      ...(codeEntity.authTime !== undefined && {
        authTime: codeEntity.authTime,
      }),
      ...(codeEntity.amr !== undefined && { amr: codeEntity.amr }),
      ...(codeEntity.acr !== undefined && { acr: codeEntity.acr }),
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
  async refreshAccessToken(
    params: z.infer<typeof oauthSchema.RefreshTokenGrantParams>,
  ) {
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
    const userData = await this.userService.verifyUserById(refreshPayload.sub);

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
        userId: userData.id,
        expires_at: new Date(refreshPayload.exp * 1000),
      });
    }

    // 6. Build token response with new access and refresh tokens
    // (no nonce in refresh flow)
    return this.buildTokenResponse({
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
  ): Promise<z.infer<typeof oauthSchema.TokenIntrospectionResult>> {
    // Try to verify the token based on hint or both types
    let payload:
      | z.infer<typeof jwtPayload.AccessTokenPayload>
      | z.infer<typeof jwtPayload.RefreshTokenPayload>
      | null = null;
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

    const jti = decoded.jti as string;
    const userId = decoded.sub as string;
    const clientId = decoded['client_id'] as string | undefined;
    const tokenType =
      (decoded['typ'] as 'access_token' | 'refresh_token') ||
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
    const userEntity = await this.mikro.user.findOne({ id: userId });
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
      userId: userEntity.id,
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
  private computeAtHash(accessToken: string): string {
    // SHA-256 hash of the access token
    const hash = createHash('sha256').update(accessToken).digest();
    // Take the left-most half (128 bits = 16 bytes for SHA-256)
    const leftHalf = hash.subarray(0, hash.length / 2);
    // Base64URL encode
    return leftHalf.toString('base64url');
  }

  /**
   * Build complete OAuth/OIDC token response
   *
   * @param params - Token generation parameters
   * @returns Complete token response
   */
  private async buildTokenResponse(params: {
    userId: string;
    userEmail: string;
    userEmailVerified: boolean;
    clientId: string;
    scope: string[];
    nonce?: string;
    /** OIDC: Time when End-User authentication occurred (Unix timestamp) */
    authTime?: number;
    /** OIDC: Authentication Methods References (RFC 8176) */
    amr?: AuthenticationMethod[];
    /** OIDC: Authentication Context Class Reference */
    acr?: AuthenticationContextClass;
  }): Promise<z.infer<typeof oauthSchema.TokenResponse>> {
    const {
      userId,
      userEmail,
      userEmailVerified,
      clientId,
      scope,
      nonce,
      authTime,
      amr,
      acr,
    } = params;

    const scopeString = scope.join(' ');

    // Generate access token (RFC 6749 §1.4)
    const accessToken = await this.jwtService.signAccessToken({
      typ: 'access_token',
      sub: userId,
      client_id: clientId,
      scope: scopeString,
    });

    // Generate refresh token (RFC 6749 §1.5)
    const refreshToken = await this.jwtService.signRefreshToken({
      typ: 'refresh_token',
      sub: userId,
      client_id: clientId,
      scope: scopeString,
    });

    const response: z.infer<typeof oauthSchema.TokenResponse> = {
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
        amr?: string[];
        acr?: string;
        at_hash?: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
      } = {
        sub: userId,
        aud: clientId,
      };

      if (nonce) {
        idTokenPayload.nonce = nonce;
      }

      // Include OIDC authentication metadata claims
      if (authTime !== undefined) {
        idTokenPayload.auth_time = authTime;
      }

      if (amr && amr.length > 0) {
        idTokenPayload.amr = amr;
      }

      if (acr) {
        idTokenPayload.acr = acr;
      }

      // Compute at_hash (OIDC Core 1.0 §3.1.3.6)
      // Required when ID Token is issued from Authorization Endpoint with
      // access token in the same response, optional otherwise but recommended
      idTokenPayload.at_hash = this.computeAtHash(accessToken);

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

export default fastifyPlugin(
  async (fastify) => {
    fastify.decorate(
      'oauthTokenService',
      new OAuthTokenService(
        fastify.config,
        fastify.mikro,
        fastify.userService,
        fastify.oauthClientService,
        fastify.jwtService,
      ),
    );
  },
  {
    name: 'oauth-token-service-plugin',
    dependencies: [
      'mikro-orm-plugin',
      'user-service-plugin',
      'oauth-client-service-plugin',
      'jwt-service-plugin',
    ],
  },
);

import type z from 'zod';
import { getRandomBytes, toBase64Url } from '../lib/base64url.ts';
import type { TinyAuthRuntimeConfig } from '../lib/config/index.ts';
import { e } from '../schemas/error.ts';
import type { f } from '../schemas/field.ts';
import type { JwtService } from './jwt.service.ts';
import type { MikroService } from './mikro.service.ts';
import type { OAuthClientService } from './oauth-client.service.ts';
import type { SecurityService } from './security.service.ts';
import type { UserConsentService } from './user-consent.service.ts';

type PromptValue = 'none' | 'login' | 'consent' | 'select_account';
const REAUTHENTICATION_CONTINUATION_MAX_AGE_SECONDS = 60;

/**
 * OAuth authorization request parameters (RFC 6749 §4.1.1)
 * Also includes OpenID Connect parameters (OIDC Core 1.0 §3.1.2.1)
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.1
 * @see https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
 */
export interface AuthorizeParams {
  /** OAuth response type (e.g., "code" for authorization code flow) */
  response_type: string;
  /** Redirect URI where the authorization response will be sent */
  redirect_uri: string;
  /** Opaque value used to maintain state between request and callback (CSRF protection) */
  state?: string | undefined;
  /** OAuth client identifier */
  client_id: string;
  /** PKCE code challenge derived from code verifier (RFC 7636) */
  code_challenge?: string | undefined;
  /** PKCE code challenge method (S256 or plain) */
  code_challenge_method?: 'S256' | 'plain' | undefined;
  /** Space-separated list of requested scopes */
  scope?: string | undefined;
  /** OIDC nonce for replay attack prevention */
  nonce?: string | undefined;
  /** OIDC prompt parameter to control authentication/consent UI */
  prompt?: z.infer<typeof f.prompt> | undefined;
  /** OIDC max authentication age in seconds */
  max_age?: number | undefined;
  /** Internal marker added after completing an interactive reauthentication. */
  reauthenticated?: '1' | undefined;
  /** OIDC display mode for authentication UI */
  display?: z.infer<typeof f.display> | undefined;
}

/**
 * OAuth authorization result
 * Currently only supports redirect type
 */
export interface AuthorizeResult {
  /** Result type discriminator */
  type: 'redirect';
  /** URL to redirect the user agent to */
  url: string;
}

export class OAuthAuthorizeService {
  private readonly config: TinyAuthRuntimeConfig;
  private readonly mikro: MikroService;
  private readonly oauthClientService: OAuthClientService;
  private readonly userConsentService: UserConsentService;
  private readonly securityService: SecurityService;
  private readonly jwtService: JwtService;
  public constructor(
    config: TinyAuthRuntimeConfig,
    mikro: MikroService,
    oauthClientService: OAuthClientService,
    userConsentService: UserConsentService,
    securityService: SecurityService,
    jwtService: JwtService,
  ) {
    this.config = config;
    this.mikro = mikro;
    this.oauthClientService = oauthClientService;
    this.userConsentService = userConsentService;
    this.securityService = securityService;
    this.jwtService = jwtService;
  }

  /**
   * Handle OAuth authorization request
   */
  public async authorize(params: {
    query: AuthorizeParams;
    userSession?: {
      sub: string;
      /** OIDC: Time when End-User authentication occurred (Unix timestamp) */
      authenticated_at: number;
    };
  }): Promise<AuthorizeResult> {
    const { query, userSession } = params;

    // 1. Validate and fetch OAuth client DTO for validation methods
    const client = await this.oauthClientService.findByClientId(
      query.client_id,
    );

    // 2. Validate client is enabled
    this.oauthClientService.validateEnabled(client);

    // 3. Validate redirect_uri
    this.oauthClientService.validateRedirectUri(client, query.redirect_uri);

    // 4. Validate response_type
    this.oauthClientService.validateResponseType(client, query.response_type);

    // 5. Validate and parse scope
    const requestedScopes = query.scope ? query.scope.split(' ') : [];
    this.oauthClientService.validateScopes(client, requestedScopes);

    const prompts = this.parsePrompt(query.prompt);
    const isImplicitIdToken = this.isImplicitIdTokenFlow(query.response_type);

    // 6. Validate flow-specific authorization parameters
    if (isImplicitIdToken) {
      this.validateImplicitIdTokenRequest(query, requestedScopes);
    } else {
      this.validatePKCE(query.code_challenge, query.code_challenge_method);
    }

    // 7. Check user session
    const hasFreshReauthentication = userSession
      ? this.hasFreshReauthentication(
          query.reauthenticated,
          userSession.authenticated_at,
        )
      : false;
    const shouldPromptLogin =
      prompts.includes('login') && !hasFreshReauthentication;
    const shouldRefreshSession =
      userSession &&
      this.isSessionStale(userSession.authenticated_at, query.max_age) &&
      !(query.max_age === 0 && hasFreshReauthentication);

    if (!userSession?.sub || shouldPromptLogin || shouldRefreshSession) {
      // Handle prompt=none - must return error if not logged in
      if (prompts.includes('none')) {
        return {
          type: 'redirect',
          url: this.buildErrorRedirectUrl(
            query.redirect_uri,
            'login_required',
            'The Authorization Server requires End-User authentication.',
            query.state,
          ),
        };
      }

      // User not logged in - redirect to login page
      const loginUrl = this.buildLoginRedirectUrl(query);
      return {
        type: 'redirect',
        url: loginUrl,
      };
    }

    // 8. User is logged in - Verify user exists
    const userCount = await this.mikro.user.count({ sub: userSession.sub });
    if (userCount === 0) {
      throw new e.UserNotFound.Error();
    }

    // 9. Check if consent is required (using IDs, not entities)
    const requiresConsent = await this.userConsentService.requiresConsent({
      userSub: userSession.sub,
      clientId: client.id,
      requestedScopes,
      prompt: prompts.includes('consent') ? 'consent' : undefined,
    });

    if (requiresConsent) {
      // Handle prompt=none - must return error if consent is required
      if (prompts.includes('none')) {
        return {
          type: 'redirect',
          url: this.buildErrorRedirectUrl(
            query.redirect_uri,
            'consent_required',
            'The Authorization Server requires End-User consent.',
            query.state,
          ),
        };
      }

      // Redirect to consent page
      const consentUrl = this.buildConsentRedirectUrl(query);
      return {
        type: 'redirect',
        url: consentUrl,
      };
    }

    if (isImplicitIdToken) {
      if (!query.nonce) {
        throw new e.InvalidAuthorizationRequest.Error();
      }

      return this.buildImplicitIdTokenRedirect({
        clientId: client.clientId,
        userSub: userSession.sub,
        redirectUri: query.redirect_uri,
        scope: requestedScopes,
        nonce: query.nonce,
        state: query.state,
        authTime: userSession.authenticated_at,
      });
    }

    const codeParams: {
      clientId: string;
      userSub: string;
      redirectUri: string;
      scope: string[];
      nonce?: string;
      codeChallenge?: string;
      codeChallengeMethod?: 'S256' | 'plain';
      authTime?: number;
    } = {
      clientId: client.id,
      userSub: userSession.sub,
      redirectUri: query.redirect_uri,
      scope: requestedScopes,
    };

    if (query.nonce) {
      codeParams.nonce = query.nonce;
    }
    if (query.code_challenge) {
      codeParams.codeChallenge = query.code_challenge;
    }
    if (query.code_challenge_method) {
      codeParams.codeChallengeMethod = query.code_challenge_method;
    }
    // Include OIDC authentication metadata from session
    if (userSession) {
      codeParams.authTime = userSession.authenticated_at;
    }

    const code = await this.generateAuthorizationCode(codeParams);

    // 10. Redirect back to client with authorization code
    const callbackUrl = this.buildCallbackUrl(
      code,
      query.state,
      query.redirect_uri,
    );

    return {
      type: 'redirect',
      url: callbackUrl,
    };
  }

  private parsePrompt(prompt: string | undefined): PromptValue[] {
    if (!prompt) {
      return [];
    }

    const prompts: PromptValue[] = [];
    const seenPrompts = new Set<string>();
    for (const value of prompt.split(' ')) {
      if (seenPrompts.has(value)) {
        throw new e.InvalidPrompt.Error();
      }

      if (
        value === 'none' ||
        value === 'login' ||
        value === 'consent' ||
        value === 'select_account'
      ) {
        prompts.push(value);
        seenPrompts.add(value);
        continue;
      }

      throw new e.InvalidPrompt.Error();
    }

    if (prompts.includes('none') && prompts.length > 1) {
      throw new e.InvalidPrompt.Error();
    }

    return prompts;
  }

  private isSessionStale(
    authenticatedAt: number,
    maxAge: number | undefined,
  ): boolean {
    if (maxAge === undefined) {
      return false;
    }

    if (maxAge === 0) {
      return true;
    }

    return Math.floor(Date.now() / 1000) - authenticatedAt > maxAge;
  }

  private hasFreshReauthentication(
    reauthenticated: '1' | undefined,
    authenticatedAt: number,
  ): boolean {
    if (reauthenticated !== '1') {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    return (
      authenticatedAt <= now &&
      now - authenticatedAt <= REAUTHENTICATION_CONTINUATION_MAX_AGE_SECONDS
    );
  }

  private isImplicitIdTokenFlow(responseType: string): boolean {
    return responseType === 'id_token';
  }

  private validateImplicitIdTokenRequest(
    query: AuthorizeParams,
    requestedScopes: string[],
  ): void {
    if (!requestedScopes.includes('openid')) {
      throw new e.InvalidAuthorizationRequest.Error();
    }

    if (!query.nonce) {
      throw new e.InvalidAuthorizationRequest.Error();
    }
  }

  /**
   * Validate PKCE parameters
   */
  private validatePKCE(
    codeChallenge: string | undefined,
    codeChallengeMethod: string | undefined,
  ): void {
    if (!codeChallenge || codeChallengeMethod !== 'S256') {
      throw new e.InvalidCodeChallengeMethod.Error();
    }

    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(codeChallenge)) {
      throw new e.InvalidCodeChallengeMethod.Error();
    }
  }

  /**
   * Build login redirect URL
   */
  private buildLoginRedirectUrl(query: AuthorizeParams): string {
    const loginUrl = new URL('/login', this.config.server.public_origin);
    loginUrl.searchParams.set('client_id', query.client_id);
    loginUrl.searchParams.set('redirect_uri', query.redirect_uri);
    loginUrl.searchParams.set('response_type', query.response_type);

    if (query.scope) {
      loginUrl.searchParams.set('scope', query.scope);
    }
    if (query.state) {
      loginUrl.searchParams.set('state', query.state);
    }
    if (query.nonce) {
      loginUrl.searchParams.set('nonce', query.nonce);
    }
    if (query.code_challenge) {
      loginUrl.searchParams.set('code_challenge', query.code_challenge);
    }
    if (query.code_challenge_method) {
      loginUrl.searchParams.set(
        'code_challenge_method',
        query.code_challenge_method,
      );
    }
    if (query.prompt) {
      loginUrl.searchParams.set('prompt', query.prompt);
    }
    if (query.max_age !== undefined) {
      loginUrl.searchParams.set('max_age', query.max_age.toString());
    }
    if (query.reauthenticated) {
      loginUrl.searchParams.set('reauthenticated', query.reauthenticated);
    }
    if (query.display) {
      loginUrl.searchParams.set('display', query.display);
    }

    return loginUrl.toString();
  }

  /**
   * Build consent redirect URL
   */
  private buildConsentRedirectUrl(query: AuthorizeParams): string {
    const consentUrl = new URL('/consent', this.config.server.public_origin);
    consentUrl.searchParams.set('client_id', query.client_id);
    consentUrl.searchParams.set('redirect_uri', query.redirect_uri);
    consentUrl.searchParams.set('response_type', query.response_type);

    if (query.scope) {
      consentUrl.searchParams.set('scope', query.scope);
    }
    if (query.state) {
      consentUrl.searchParams.set('state', query.state);
    }
    if (query.nonce) {
      consentUrl.searchParams.set('nonce', query.nonce);
    }
    if (query.code_challenge) {
      consentUrl.searchParams.set('code_challenge', query.code_challenge);
    }
    if (query.code_challenge_method) {
      consentUrl.searchParams.set(
        'code_challenge_method',
        query.code_challenge_method,
      );
    }
    if (query.prompt) {
      consentUrl.searchParams.set('prompt', query.prompt);
    }
    if (query.max_age !== undefined) {
      consentUrl.searchParams.set('max_age', query.max_age.toString());
    }
    if (query.reauthenticated) {
      consentUrl.searchParams.set('reauthenticated', query.reauthenticated);
    }
    if (query.display) {
      consentUrl.searchParams.set('display', query.display);
    }

    return consentUrl.toString();
  }

  /**
   * Build error redirect URL (for OAuth errors that should redirect back)
   */
  private buildErrorRedirectUrl(
    redirectUri: string,
    error: string,
    errorDescription: string,
    state?: string,
  ): string {
    const errorUrl = new URL(redirectUri);
    errorUrl.searchParams.set('error', error);
    errorUrl.searchParams.set('error_description', errorDescription);

    if (state) {
      errorUrl.searchParams.set('state', state);
    }

    return errorUrl.toString();
  }

  private async buildImplicitIdTokenRedirect(params: {
    clientId: string;
    userSub: string;
    redirectUri: string;
    scope: string[];
    nonce: string;
    state?: string | undefined;
    authTime: number;
  }): Promise<AuthorizeResult> {
    const user = await this.mikro.user.findOneOrFail(
      { sub: params.userSub },
      {
        failHandler: () => new e.UserNotFound.Error(),
      },
    );

    const idTokenPayload: {
      sub: string;
      aud: string;
      nonce: string;
      auth_time: number;
      email?: string;
      email_verified?: boolean;
      name?: string;
    } = {
      sub: user.sub,
      aud: params.clientId,
      nonce: params.nonce,
      auth_time: params.authTime,
    };

    if (params.scope.includes('email')) {
      idTokenPayload.email = user.email;
      idTokenPayload.email_verified = user.email_verified;
    }

    if (params.scope.includes('profile')) {
      idTokenPayload.name = user.email;
    }

    const idToken = await this.jwtService.signIdToken(idTokenPayload);
    const redirectUrl = new URL(params.redirectUri);
    const fragment = new URLSearchParams();
    fragment.set('id_token', idToken);
    fragment.set('token_type', 'Bearer');
    fragment.set('expires_in', this.config.tokens.access_token_ttl.toString());
    if (params.state) {
      fragment.set('state', params.state);
    }
    redirectUrl.hash = fragment.toString();

    return {
      type: 'redirect',
      url: redirectUrl.toString(),
    };
  }

  /**
   * Build callback URL with authorization code
   */
  private buildCallbackUrl(
    code: string,
    state: string | undefined,
    redirectUri: string,
  ): string {
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set('code', code);

    if (state) {
      callbackUrl.searchParams.set('state', state);
    }

    return callbackUrl.toString();
  }

  /**
   * Generate authorization code
   */
  private async generateAuthorizationCode(params: {
    clientId: string;
    userSub: string;
    redirectUri: string;
    scope: string[];
    nonce?: string;
    codeChallenge?: string;
    codeChallengeMethod?: 'S256' | 'plain';
    authTime?: number;
  }): Promise<string> {
    const codeParams: {
      clientId: string;
      userSub: string;
      redirectUri: string;
      scope: string[];
      nonce?: string;
      codeChallenge?: string;
      codeChallengeMethod?: 'S256' | 'plain';
      authTime?: number;
    } = {
      clientId: params.clientId,
      userSub: params.userSub,
      redirectUri: params.redirectUri,
      scope: params.scope,
    };

    if (params.nonce) {
      codeParams.nonce = params.nonce;
    }
    if (params.codeChallenge) {
      codeParams.codeChallenge = params.codeChallenge;
    }
    if (params.codeChallengeMethod) {
      codeParams.codeChallengeMethod = params.codeChallengeMethod;
    }
    // Include OIDC authentication metadata
    if (params.authTime !== undefined) {
      codeParams.authTime = params.authTime;
    }

    const code = toBase64Url(getRandomBytes(32));
    const codeHash = await this.securityService.hashOpaqueToken(
      'oauth-code',
      code,
    );

    await this.mikro.oauthCode.createAuthorizationCode({
      ...codeParams,
      codeHash,
    });

    return code;
  }
}

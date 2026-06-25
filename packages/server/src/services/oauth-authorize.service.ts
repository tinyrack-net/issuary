import type z from 'zod';
import { getRandomBytes, toBase64Url } from '../lib/base64url.ts';
import type { TinyAuthRuntimeConfig } from '../lib/config/index.ts';
import type { AccountSelectionSession } from '../middleware/session.ts';
import { e } from '../schemas/error.ts';
import type { f } from '../schemas/field.ts';
import { AccountSelectionService } from './account-selection.service.ts';
import type { JwtService } from './jwt.service.ts';
import type { MikroService } from './mikro.service.ts';
import type { OAuthClientService } from './oauth-client.service.ts';
import type { SecurityService } from './security.service.ts';
import type { UserConsentService } from './user-consent.service.ts';

type PromptValue = 'none' | 'login' | 'consent' | 'select_account';
type ResponseMode = 'query' | 'fragment' | 'form_post';
const REAUTHENTICATION_CONTINUATION_MAX_AGE_SECONDS = 60;
const ACCOUNT_SELECTION_CONTINUATION_MAX_AGE_SECONDS = 300;

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
  response_mode?: string | undefined;
  login_hint?: string | undefined;
  ui_locales?: string | undefined;
  id_token_hint?: string | undefined;
  acr_values?: string | undefined;
  /** Internal marker added after the user explicitly selected an account. */
  account_selected?: '1' | undefined;
  /** Internal server-side continuation id created before showing account chooser. */
  account_selection_state?: string | undefined;
}

/**
 * OAuth authorization result
 * Currently only supports redirect type
 */
export interface AuthorizeResult {
  /** Result type discriminator */
  type: 'redirect' | 'form_post';
  /** URL to redirect the user agent to */
  url: string;
  params?: Record<string, string>;
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
    rememberedAccounts?: Array<{
      sub: string;
      authenticated_at: number;
      last_used_at: number;
      email?: string | undefined;
    }>;
    selectUserSession?: (
      userSub: string,
    ) => boolean | undefined | Promise<boolean | undefined>;
    accountSelectionSession?: AccountSelectionSession | undefined;
    setAccountSelectionSession?: (state: AccountSelectionSession) => void;
    clearAccountSelectionSession?: () => void;
  }): Promise<AuthorizeResult> {
    const { userSession } = params;
    const rawQuery = params.query;

    // 1. Validate and fetch OAuth client DTO for validation methods
    const client = await this.oauthClientService.findByClientId(
      rawQuery.client_id,
    );

    // 2. Validate client is enabled
    this.oauthClientService.validateEnabled(client);

    // 3. Validate redirect_uri
    this.oauthClientService.validateRedirectUri(client, rawQuery.redirect_uri);

    const responseMode = this.parseResponseMode(rawQuery.response_mode);
    const query = {
      ...rawQuery,
      response_mode: responseMode,
    };

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
      await this.validateAuthorizationCodePKCE(
        client.clientId,
        query.code_challenge,
        query.code_challenge_method,
      );
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
        return this.buildErrorAuthorizationResult({
          redirectUri: query.redirect_uri,
          error: 'login_required',
          errorDescription:
            'The Authorization Server requires End-User authentication.',
          state: query.state,
          responseMode: query.response_mode,
        });
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

    const rememberedAccounts = await this.enrichRememberedAccounts(
      params.rememberedAccounts?.length
        ? params.rememberedAccounts
        : [
            {
              sub: userSession.sub,
              authenticated_at: userSession.authenticated_at,
              last_used_at: userSession.authenticated_at,
            },
          ],
    );
    const accountSelectionContinuation =
      this.getTrustedAccountSelectionContinuation({
        query,
        session: params.accountSelectionSession,
        clientId: client.clientId,
        activeUserSub: userSession.sub,
        freshReauthentication: hasFreshReauthentication,
      });
    const accountSelection = new AccountSelectionService(this.config).decide({
      clientId: client.clientId,
      prompts,
      activeUserSub: userSession.sub,
      rememberedAccounts,
      maxAge: query.max_age,
      loginHint: query.login_hint,
      accountSelected: accountSelectionContinuation.trusted,
      freshReauthentication: hasFreshReauthentication,
    });

    if (accountSelection.type === 'oauth_error') {
      return this.buildErrorAuthorizationResult({
        redirectUri: query.redirect_uri,
        error: accountSelection.error,
        errorDescription: accountSelection.errorDescription,
        state: query.state,
        responseMode: query.response_mode,
      });
    }

    if (accountSelection.type === 'show_chooser') {
      let accountSelectionState = accountSelectionContinuation.id;
      if (
        !accountSelectionContinuation.matchesExisting ||
        !accountSelectionState
      ) {
        const continuation = this.createAccountSelectionSession({
          clientId: client.clientId,
          query,
          rememberedAccounts,
        });
        params.setAccountSelectionSession?.(continuation);
        accountSelectionState = continuation.id;
      }
      return {
        type: 'redirect',
        url: this.buildAccountSelectRedirectUrl(query, accountSelectionState),
      };
    }

    if (accountSelection.type === 'reauthenticate') {
      return {
        type: 'redirect',
        url: this.buildLoginRedirectUrl(query),
      };
    }

    const selectedSession =
      rememberedAccounts.find(
        (account) => account.sub === accountSelection.selectedSub,
      ) ?? userSession;

    if (
      accountSelectionContinuation.trusted &&
      !accountSelectionContinuation.allowAddAccount &&
      !accountSelectionContinuation.allowedSubs.includes(selectedSession.sub)
    ) {
      throw new e.InvalidAuthorizationRequest.Error();
    }

    if (selectedSession.sub !== userSession.sub) {
      const selected = await params.selectUserSession?.(selectedSession.sub);
      if (selected === false) {
        throw new e.InvalidAuthorizationRequest.Error();
      }
    }

    // 9. Check if consent is required (using IDs, not entities)
    const requiresConsent = await this.userConsentService.requiresConsent({
      userSub: selectedSession.sub,
      clientId: client.id,
      requestedScopes,
      prompt: prompts.includes('consent') ? 'consent' : undefined,
      skipConsent: client.skipConsent,
    });

    if (requiresConsent) {
      // Handle prompt=none - must return error if consent is required
      if (prompts.includes('none')) {
        return this.buildErrorAuthorizationResult({
          redirectUri: query.redirect_uri,
          error: 'consent_required',
          errorDescription:
            'The Authorization Server requires End-User consent.',
          state: query.state,
          responseMode: query.response_mode,
        });
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

      params.clearAccountSelectionSession?.();
      return this.buildImplicitIdTokenRedirect({
        clientId: client.clientId,
        userSub: selectedSession.sub,
        redirectUri: query.redirect_uri,
        scope: requestedScopes,
        nonce: query.nonce,
        state: query.state,
        authTime: selectedSession.authenticated_at,
        responseMode: query.response_mode,
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
      userSub: selectedSession.sub,
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
      codeParams.authTime = selectedSession.authenticated_at;
    }

    const code = await this.generateAuthorizationCode(codeParams);
    params.clearAccountSelectionSession?.();

    // 10. Redirect back to client with authorization code
    const callbackUrl = this.buildCallbackUrl(
      code,
      query.state,
      query.redirect_uri,
      query.response_mode,
    );

    if (query.response_mode === 'form_post') {
      const params: Record<string, string> = { code };
      if (query.state) {
        params['state'] = query.state;
      }
      return {
        type: 'form_post',
        url: query.redirect_uri,
        params,
      };
    }

    return {
      type: 'redirect',
      url: callbackUrl,
    };
  }

  private parseResponseMode(
    responseMode: string | undefined,
  ): ResponseMode | undefined {
    if (responseMode === undefined) {
      return undefined;
    }

    if (
      responseMode === 'query' ||
      responseMode === 'fragment' ||
      responseMode === 'form_post'
    ) {
      return responseMode;
    }

    throw new e.InvalidAuthorizationRequest.Error();
  }

  private createAccountSelectionSession(params: {
    clientId: string;
    query: AuthorizeParams;
    rememberedAccounts: Array<{ sub: string }>;
  }): AccountSelectionSession {
    const clientOverride = this.config.clients.find(
      (client) => client.client_id === params.clientId,
    )?.account_selection;
    return {
      id: toBase64Url(getRandomBytes(24)),
      client_id: params.clientId,
      request_fingerprint: this.buildAccountSelectionRequestFingerprint(
        params.query,
      ),
      allow_add_account:
        clientOverride?.allow_add_account ??
        this.config.auth.account_selection.allow_add_account,
      allowed_subs: Array.from(
        new Set(params.rememberedAccounts.map((account) => account.sub)),
      ),
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  private buildAccountSelectionRequestFingerprint(
    query: AuthorizeParams,
  ): string {
    return JSON.stringify(
      [
        ['client_id', query.client_id],
        ['redirect_uri', query.redirect_uri],
        ['response_type', query.response_type],
        ['scope', query.scope],
        ['state', query.state],
        ['nonce', query.nonce],
        ['code_challenge', query.code_challenge],
        ['code_challenge_method', query.code_challenge_method],
        [
          'prompt',
          this.normalizePromptForAccountSelectionFingerprint(query.prompt),
        ],
        ['max_age', query.max_age],
        ['display', query.display],
        ['response_mode', query.response_mode],
        ['login_hint', query.login_hint],
        ['ui_locales', query.ui_locales],
        ['id_token_hint', query.id_token_hint],
        ['acr_values', query.acr_values],
      ].filter(([, value]) => value !== undefined),
    );
  }

  private normalizePromptForAccountSelectionFingerprint(
    prompt: string | undefined,
  ): string | undefined {
    if (!prompt) {
      return undefined;
    }
    const values = prompt
      .split(' ')
      .filter((value) => value !== 'consent' && value !== 'login');
    return values.length > 0 ? values.join(' ') : undefined;
  }

  private getTrustedAccountSelectionContinuation(params: {
    query: AuthorizeParams;
    session: AccountSelectionSession | undefined;
    clientId: string;
    activeUserSub: string;
    freshReauthentication: boolean;
  }): {
    trusted: boolean;
    matchesExisting: boolean;
    id?: string;
    allowAddAccount: boolean;
    allowedSubs: string[];
  } {
    const { query, session } = params;
    const now = Math.floor(Date.now() / 1000);
    const matchesExisting =
      session?.client_id === params.clientId &&
      session.request_fingerprint ===
        this.buildAccountSelectionRequestFingerprint(query) &&
      session.created_at <= now &&
      now - session.created_at <=
        ACCOUNT_SELECTION_CONTINUATION_MAX_AGE_SECONDS;

    if (!session || !matchesExisting) {
      const freshSelectedAccount =
        params.freshReauthentication && query.account_selected === '1';
      return {
        trusted: freshSelectedAccount,
        matchesExisting: false,
        allowAddAccount: freshSelectedAccount,
        allowedSubs: freshSelectedAccount ? [params.activeUserSub] : [],
      };
    }

    if (
      !session.allow_add_account &&
      !session.allowed_subs.includes(params.activeUserSub)
    ) {
      throw new e.InvalidAuthorizationRequest.Error();
    }

    return {
      trusted:
        query.account_selected === '1' &&
        query.account_selection_state === session.id,
      matchesExisting: true,
      id: session.id,
      allowAddAccount: session.allow_add_account,
      allowedSubs: session.allowed_subs,
    };
  }

  private async enrichRememberedAccounts(
    accounts: Array<{
      sub: string;
      authenticated_at: number;
      last_used_at: number;
      email?: string | undefined;
    }>,
  ): Promise<
    Array<{
      sub: string;
      authenticated_at: number;
      last_used_at: number;
      email?: string | undefined;
    }>
  > {
    return Promise.all(
      accounts.map(async (account) => {
        if (account.email) {
          return account;
        }
        const user = await this.mikro.user.findOne({
          sub: account.sub,
          deleted_at: null,
        });
        return user ? { ...account, email: user.email } : account;
      }),
    );
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

    if (query.response_mode === 'query') {
      throw new e.InvalidAuthorizationRequest.Error();
    }
  }

  /**
   * Validate PKCE parameters for authorization-code requests.
   *
   * Public clients must use S256 PKCE. Confidential clients may omit PKCE
   * because the token endpoint still authenticates them with client_secret,
   * but if they do send a code_challenge it must be S256 and well-formed.
   */
  private async validateAuthorizationCodePKCE(
    clientId: string,
    codeChallenge: string | undefined,
    codeChallengeMethod: string | undefined,
  ): Promise<void> {
    if (!codeChallenge) {
      if (codeChallengeMethod) {
        throw new e.InvalidCodeChallengeMethod.Error();
      }
      if (await this.oauthClientService.isPublicClient(clientId)) {
        throw new e.InvalidCodeChallengeMethod.Error();
      }
      return;
    }

    if (codeChallengeMethod !== 'S256') {
      throw new e.InvalidCodeChallengeMethod.Error();
    }

    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(codeChallenge)) {
      throw new e.InvalidCodeChallengeMethod.Error();
    }
  }

  private copyAuthorizeParams(url: URL, query: AuthorizeParams): void {
    url.searchParams.set('client_id', query.client_id);
    url.searchParams.set('redirect_uri', query.redirect_uri);
    url.searchParams.set('response_type', query.response_type);
    if (query.scope) url.searchParams.set('scope', query.scope);
    if (query.state) url.searchParams.set('state', query.state);
    if (query.nonce) url.searchParams.set('nonce', query.nonce);
    if (query.code_challenge) {
      url.searchParams.set('code_challenge', query.code_challenge);
    }
    if (query.code_challenge_method) {
      url.searchParams.set(
        'code_challenge_method',
        query.code_challenge_method,
      );
    }
    if (query.prompt) url.searchParams.set('prompt', query.prompt);
    if (query.max_age !== undefined) {
      url.searchParams.set('max_age', query.max_age.toString());
    }
    if (query.reauthenticated) {
      url.searchParams.set('reauthenticated', query.reauthenticated);
    }
    if (query.display) url.searchParams.set('display', query.display);
    this.preserveCompatibilityParams(url, query);
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
    this.preserveCompatibilityParams(loginUrl, query);

    return loginUrl.toString();
  }

  private buildAccountSelectRedirectUrl(
    query: AuthorizeParams,
    accountSelectionState: string,
  ): string {
    const accountSelectUrl = new URL(
      '/account/select',
      this.config.server.public_origin,
    );
    this.copyAuthorizeParams(accountSelectUrl, {
      ...query,
      account_selected: undefined,
      account_selection_state: accountSelectionState,
    });
    return accountSelectUrl.toString();
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
      const consentPrompt = query.prompt
        .split(' ')
        .filter((value) => value !== 'login')
        .join(' ');
      if (consentPrompt) {
        consentUrl.searchParams.set('prompt', consentPrompt);
      }
    }
    if (query.max_age !== undefined) {
      consentUrl.searchParams.set('max_age', query.max_age.toString());
    }
    if (query.display) {
      consentUrl.searchParams.set('display', query.display);
    }
    this.preserveCompatibilityParams(consentUrl, query);

    return consentUrl.toString();
  }

  private preserveCompatibilityParams(url: URL, query: AuthorizeParams): void {
    if (query.response_mode) {
      url.searchParams.set('response_mode', query.response_mode);
    }
    if (query.login_hint) {
      url.searchParams.set('login_hint', query.login_hint);
    }
    if (query.ui_locales) {
      url.searchParams.set('ui_locales', query.ui_locales);
    }
    if (query.id_token_hint) {
      url.searchParams.set('id_token_hint', query.id_token_hint);
    }
    if (query.acr_values) {
      url.searchParams.set('acr_values', query.acr_values);
    }
    if (query.account_selected) {
      url.searchParams.set('account_selected', query.account_selected);
    }
    if (query.account_selection_state) {
      url.searchParams.set(
        'account_selection_state',
        query.account_selection_state,
      );
    }
  }

  /**
   * Build error redirect URL (for OAuth errors that should redirect back)
   */
  private buildErrorRedirectUrl(
    redirectUri: string,
    error: string,
    errorDescription: string,
    state?: string,
    responseMode?: 'query' | 'fragment' | 'form_post',
  ): string {
    const errorUrl = new URL(redirectUri);
    const useFragment = responseMode === 'fragment';
    const params = useFragment ? new URLSearchParams() : errorUrl.searchParams;
    params.set('error', error);
    params.set('error_description', errorDescription);

    if (state) {
      params.set('state', state);
    }

    if (useFragment) {
      errorUrl.hash = params.toString();
    }

    return errorUrl.toString();
  }

  private buildErrorAuthorizationResult(params: {
    redirectUri: string;
    error: string;
    errorDescription: string;
    state?: string | undefined;
    responseMode?: 'query' | 'fragment' | 'form_post' | undefined;
  }): AuthorizeResult {
    if (params.responseMode === 'form_post') {
      const formParams: Record<string, string> = {
        error: params.error,
        error_description: params.errorDescription,
      };
      if (params.state) {
        formParams['state'] = params.state;
      }
      return {
        type: 'form_post',
        url: params.redirectUri,
        params: formParams,
      };
    }

    return {
      type: 'redirect',
      url: this.buildErrorRedirectUrl(
        params.redirectUri,
        params.error,
        params.errorDescription,
        params.state,
        params.responseMode,
      ),
    };
  }

  private async buildImplicitIdTokenRedirect(params: {
    clientId: string;
    userSub: string;
    redirectUri: string;
    scope: string[];
    nonce: string;
    state?: string | undefined;
    authTime: number;
    responseMode?: 'query' | 'fragment' | 'form_post' | undefined;
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
    if (params.responseMode === 'form_post') {
      const formParams: Record<string, string> = {
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: this.config.tokens.access_token_ttl.toString(),
      };
      if (params.state) {
        formParams['state'] = params.state;
      }
      return {
        type: 'form_post',
        url: params.redirectUri,
        params: formParams,
      };
    }

    const redirectUrl = new URL(params.redirectUri);
    const fragment = new URLSearchParams();
    fragment.set('id_token', idToken);
    fragment.set('token_type', 'Bearer');
    fragment.set('expires_in', this.config.tokens.access_token_ttl.toString());
    if (params.state) {
      fragment.set('state', params.state);
    }
    if (params.responseMode === 'query') {
      redirectUrl.search = fragment.toString();
    } else {
      redirectUrl.hash = fragment.toString();
    }

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
    responseMode?: 'query' | 'fragment' | 'form_post',
  ): string {
    const callbackUrl = new URL(redirectUri);
    const useFragment = responseMode === 'fragment';
    const params = useFragment
      ? new URLSearchParams()
      : callbackUrl.searchParams;
    params.set('code', code);

    if (state) {
      params.set('state', state);
    }

    if (useFragment) {
      callbackUrl.hash = params.toString();
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

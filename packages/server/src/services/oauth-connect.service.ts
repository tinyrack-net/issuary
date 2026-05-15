import { createRemoteJWKSet, jwtVerify } from 'jose';
import z from 'zod';
import type {
  IdentityProviderConfig,
  TinyAuthRuntimeConfig,
} from '../lib/config/index.ts';
import { isEmailAllowed } from '../lib/email-pattern.ts';
import { generatePKCE } from '../lib/pkce.ts';
import { e, TinyAuthError } from '../schemas/error.ts';
import type { f } from '../schemas/field.ts';
import type { r } from '../schemas/response.ts';
import type { MikroService } from './mikro.service.ts';
import type { TermsService } from './terms.service.ts';
import type { UserService } from './user.service.ts';

/**
 * OAuth user info returned from provider
 * Normalized user information from external OAuth providers
 */
export interface OAuthUserInfo {
  /** Provider's user ID */
  id: string;
  /** User's email address */
  email: string;
  /** Whether the email is verified by the provider */
  email_verified: boolean;
  /** User's display name */
  name?: string | undefined;
  /** User's profile picture URL */
  picture?: string | undefined;
}

function parseEmailVerified(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true';
  }

  return false;
}

/**
 * Token response from OAuth provider
 * Standard OAuth 2.0 token response structure
 */
const OAuthTokenTypeSchema = z
  .string()
  .refine((value) => value.toLowerCase() === 'bearer')
  .transform(() => 'Bearer');

const OAuthTokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  token_type: OAuthTokenTypeSchema,
  id_token: z.string().optional(),
});

export type OAuthTokens = z.infer<typeof OAuthTokensSchema>;

/**
 * OAuth session data stored in secure session
 * Used to maintain state during OAuth flow
 */
export interface OAuthSessionData {
  /** State parameter for CSRF protection */
  state: string;
  /** PKCE code verifier */
  codeVerifier: string;
  /** OAuth provider ID */
  providerId: string;
  /** Authentication mode */
  mode: z.infer<typeof f.oauthConnectMode>;
  /** URL to return to after authentication */
  returnUrl?: string | undefined;
}

/**
 * Result of OAuth authentication
 * Returned after successful OAuth login/registration
 */
export interface OAuthAuthResult {
  /** Whether this is a newly created user */
  isNewUser: boolean;
  /** Authenticated user session data */
  user: z.infer<typeof r.UserSession>;
}

/**
 * Result of processing an OAuth callback.
 * Each variant tells the handler what session changes and redirect to perform.
 */
export type OAuthCallbackResult =
  | { action: 'error_redirect'; url: string }
  | { action: 'link_complete'; returnUrl: string }
  | {
      action: 'terms_redirect';
      url: string;
    }
  | {
      action: 'login_complete';
      userSub: string;
      returnUrl: string | undefined;
    }
  | {
      action: 'login_terms_redirect';
      userSub: string;
      termsUrl: string;
    };

// Note: This service uses fastify.config for identity_providers (OAuth providers config)
// but user-related config lookups have been removed since users are now synced to DB.

export class OAuthConnectService {
  private readonly config: TinyAuthRuntimeConfig;
  private readonly userService: UserService;
  private readonly mikro: MikroService;
  private readonly termsService: TermsService;
  public constructor(
    config: TinyAuthRuntimeConfig,
    userService: UserService,
    mikro: MikroService,
    termsService: TermsService,
  ) {
    this.config = config;
    this.userService = userService;
    this.mikro = mikro;
    this.termsService = termsService;
  }

  /**
   * Process an OAuth callback: validate session, exchange tokens, and
   * determine the appropriate next action (redirect, login, link, terms).
   * Pure business logic — no session writes or HTTP responses.
   */
  public async processOAuthCallback(params: {
    provider: string;
    code: string;
    state: string;
    oauthSession: OAuthSessionData;
    userSub?: string | undefined;
    requestUrl: string;
  }): Promise<OAuthCallbackResult> {
    const { provider, code, state, oauthSession, userSub, requestUrl } = params;

    // Validate state parameter
    if (oauthSession.state !== state) {
      throw new e.OAuthStateMismatch.Error();
    }

    // Validate provider matches
    if (oauthSession.providerId !== provider) {
      throw new e.OAuthProviderNotFound.Error();
    }

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(
      provider,
      code,
      oauthSession.codeVerifier,
    );

    // Fetch user info from provider
    const userInfo = await this.fetchUserInfo(
      provider,
      tokens.access_token,
      tokens.id_token,
    );

    // Handle link mode
    if (oauthSession.mode === 'link') {
      if (!userSub) {
        throw new e.Unauthorized.Error();
      }

      await this.linkOAuthAccount(userSub, provider, tokens, userInfo);

      const returnUrl = oauthSession.returnUrl || '/profile';
      return { action: 'link_complete', returnUrl };
    }

    // Check if this would be a new user
    const isNewUser = await this.isNewOAuthUser(provider, userInfo);

    // For new users, check registration enabled and email allowlist
    if (isNewUser) {
      const { enabled, allowed_email_patterns } = this.config.registration;
      if (
        !enabled ||
        (allowed_email_patterns.length > 0 &&
          !isEmailAllowed(userInfo.email, allowed_email_patterns))
      ) {
        const errorUrl = new URL('/login', this.config.server.public_origin);
        errorUrl.searchParams.set(
          'oauth_error',
          'registration_email_not_allowed',
        );
        if (oauthSession.returnUrl) {
          errorUrl.searchParams.set('redirect', oauthSession.returnUrl);
        }
        return { action: 'error_redirect', url: errorUrl.toString() };
      }
    }

    // Load terms once and reuse
    const allTerms = await this.termsService.getGlobalTerms();
    const explicitTerms = await this.termsService.getExplicitTerms(allTerms);

    if (isNewUser && explicitTerms.length > 0) {
      // New user with explicit terms: persist to DB
      const pendingToken =
        await this.mikro.pendingOAuthRegistration.createPendingRegistration({
          providerId: provider,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
          tokenType: tokens.token_type,
          userInfo: {
            id: userInfo.id,
            email: userInfo.email,
            email_verified: userInfo.email_verified,
            name: userInfo.name,
            picture: userInfo.picture,
          },
          returnUrl: oauthSession.returnUrl,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });

      const termsUrl = new URL('/terms', `${this.config.server.public_origin}`);
      termsUrl.searchParams.set('mode', 'complete_registration');
      termsUrl.searchParams.set('registration_token', pendingToken);
      if (oauthSession.returnUrl) {
        termsUrl.searchParams.set('redirect', oauthSession.returnUrl);
      }
      return { action: 'terms_redirect', url: termsUrl.toString() };
    }

    // Login/Register mode: authenticate with OAuth
    try {
      const result = await this.authenticateWithOAuth(
        provider,
        tokens,
        userInfo,
      );

      // Check if existing user needs to see terms page
      if (!result.isNewUser && explicitTerms.length > 0) {
        const pendingTerms = await this.termsService.getPendingRequiredTerms(
          result.user.sub,
        );
        const explicitTermIds = new Set(explicitTerms.map((t) => t.id));
        const shouldRedirectToTerms = pendingTerms.some((id) =>
          explicitTermIds.has(id),
        );

        if (shouldRedirectToTerms) {
          const url = new URL(requestUrl);
          const termsUrl = new URL('/terms', `${url.protocol}//${url.host}`);
          if (oauthSession.returnUrl) {
            termsUrl.searchParams.set('redirect', oauthSession.returnUrl);
          }
          return {
            action: 'login_terms_redirect',
            userSub: result.user.sub,
            termsUrl: termsUrl.toString(),
          };
        }
      }

      return {
        action: 'login_complete',
        userSub: result.user.sub,
        returnUrl: oauthSession.returnUrl,
      };
    } catch (err) {
      if (
        err instanceof TinyAuthError &&
        err.code === 'REGISTRATION_EMAIL_NOT_ALLOWED'
      ) {
        const errorUrl = new URL('/login', this.config.server.public_origin);
        errorUrl.searchParams.set(
          'oauth_error',
          'registration_email_not_allowed',
        );
        if (oauthSession.returnUrl) {
          errorUrl.searchParams.set('redirect', oauthSession.returnUrl);
        }
        return { action: 'error_redirect', url: errorUrl.toString() };
      }
      throw err;
    }
  }

  /**
   * Get all enabled OAuth providers
   */
  public getEnabledProviders(): Array<{
    id: string;
    display_name: string;
    icon_url?: string | undefined;
  }> {
    const providers: Array<{
      id: string;
      display_name: string;
      icon_url?: string | undefined;
    }> = [];

    for (const provider of this.config.identity_providers) {
      if (provider.enabled) {
        providers.push({
          id: provider.id,
          display_name: provider.display_name,
          icon_url: provider.icon_url,
        });
      }
    }

    return providers;
  }

  /**
   * Get OAuth provider config by id
   */
  public getProvider(id: string): IdentityProviderConfig {
    const provider = this.config.identity_providers.find(
      (providerConfig) => providerConfig.id === id,
    );

    if (!provider?.enabled) {
      throw new e.OAuthProviderNotFound.Error();
    }

    return provider;
  }

  /**
   * Generate authorization URL with state and PKCE
   */
  public async generateAuthorizationUrl(
    providerId: string,
    mode: z.infer<typeof f.oauthConnectMode>,
    returnUrl?: string,
  ): Promise<{
    url: string;
    sessionData: OAuthSessionData;
  }> {
    const provider = this.getProvider(providerId);
    const pkce = await generatePKCE();
    const state = crypto.randomUUID();

    const params = new URLSearchParams({
      client_id: provider.client_id,
      redirect_uri: `${this.config.server.public_origin}/api/oauth/${providerId}/callback`,
      response_type: 'code',
      scope: provider.scopes.join(' '),
      state,
      code_challenge: pkce.challenge,
      code_challenge_method: pkce.method,
    });

    // Add response_mode if specified (e.g., 'form_post' for Apple)
    if (provider.response_mode) {
      params.set('response_mode', provider.response_mode);
    }

    const url = `${provider.authorization_url}?${params.toString()}`;

    const sessionData: OAuthSessionData = {
      state,
      codeVerifier: pkce.verifier,
      providerId,
      mode,
      returnUrl,
    };

    return { url, sessionData };
  }

  /**
   * Exchange authorization code for tokens
   */
  public async exchangeCodeForTokens(
    providerId: string,
    code: string,
    codeVerifier: string,
  ): Promise<OAuthTokens> {
    const provider = this.getProvider(providerId);

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${this.config.server.public_origin}/api/oauth/${providerId}/callback`,
      client_id: provider.client_id,
      client_secret: provider.client_secret,
      code_verifier: codeVerifier,
    });

    const response = await fetch(provider.token_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new e.OAuthTokenExchangeFailed.Error();
    }

    try {
      const json: unknown = await response.json();
      return OAuthTokensSchema.parse(json);
    } catch {
      throw new e.OAuthTokenExchangeFailed.Error();
    }
  }

  /**
   * Fetch user info from OAuth provider.
   * For providers without a userinfo endpoint (e.g. Apple), decodes the ID token.
   */
  public async fetchUserInfo(
    providerId: string,
    accessToken: string,
    idToken?: string,
  ): Promise<OAuthUserInfo> {
    const provider = this.getProvider(providerId);

    // Providers without a userinfo endpoint (e.g. Apple) use the ID token
    if (!provider.userinfo_url) {
      return this.extractUserInfoFromIdToken(provider, idToken);
    }

    const response = await fetch(provider.userinfo_url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new e.OAuthUserInfoFailed.Error();
    }

    try {
      const json: unknown = await response.json();
      const data = z.record(z.string(), z.unknown()).parse(json);
      return this.mapUserInfo(provider, data);
    } catch {
      throw new e.OAuthUserInfoFailed.Error();
    }
  }

  /**
   * Extract user info from an ID token JWT for providers with trusted JWKS.
   */
  private async extractUserInfoFromIdToken(
    provider: IdentityProviderConfig,
    idToken?: string,
  ): Promise<OAuthUserInfo> {
    if (!idToken) {
      throw new e.OAuthUserInfoFailed.Error();
    }

    try {
      const claims =
        provider.type === 'apple'
          ? await this.verifyAppleIdToken(provider, idToken)
          : await this.verifyGenericIdToken(provider, idToken);
      this.validateProviderIdTokenClaims(provider, claims);
      return this.mapUserInfo(provider, claims);
    } catch {
      throw new e.OAuthUserInfoFailed.Error();
    }
  }

  private async verifyAppleIdToken(
    provider: IdentityProviderConfig,
    idToken: string,
  ) {
    const jwksUrl = provider.jwks_url ?? 'https://appleid.apple.com/auth/keys';
    const jwks = createRemoteJWKSet(new URL(jwksUrl));
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: 'https://appleid.apple.com',
      audience: provider.client_id,
      algorithms: ['RS256'],
    });

    const issuedAt = payload.iat;
    if (issuedAt !== undefined && typeof issuedAt !== 'number') {
      throw new e.OAuthUserInfoFailed.Error();
    }

    return payload;
  }

  private async verifyGenericIdToken(
    provider: IdentityProviderConfig,
    idToken: string,
  ) {
    if (!provider.jwks_url) {
      throw new e.OAuthUserInfoFailed.Error();
    }
    if (!provider.issuer) {
      throw new e.OAuthUserInfoFailed.Error();
    }

    const jwks = createRemoteJWKSet(new URL(provider.jwks_url));
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: provider.issuer,
      audience: provider.client_id,
    });

    return payload;
  }

  private validateProviderIdTokenClaims(
    provider: IdentityProviderConfig,
    claims: Record<string, unknown>,
  ): void {
    if (provider.type !== 'apple') {
      return;
    }

    if (claims['iss'] !== 'https://appleid.apple.com') {
      throw new e.OAuthUserInfoFailed.Error();
    }

    const audience = claims['aud'];
    if (typeof audience === 'string') {
      if (audience !== provider.client_id) {
        throw new e.OAuthUserInfoFailed.Error();
      }
    } else if (Array.isArray(audience)) {
      const hasClientId = audience.some(
        (value) => value === provider.client_id,
      );
      if (!hasClientId) {
        throw new e.OAuthUserInfoFailed.Error();
      }
    } else {
      throw new e.OAuthUserInfoFailed.Error();
    }

    const expiresAt = claims['exp'];
    if (typeof expiresAt !== 'number' || expiresAt * 1000 <= Date.now()) {
      throw new e.OAuthUserInfoFailed.Error();
    }
  }

  /**
   * Map provider-specific field names to normalized OAuthUserInfo
   * using the provider's userinfo_mapping configuration.
   */
  private mapUserInfo(
    provider: IdentityProviderConfig,
    data: Record<string, unknown>,
  ): OAuthUserInfo {
    const mapping = provider.userinfo_mapping;

    // Extract user ID
    const id = String(data[mapping.id] ?? '');
    if (!id) {
      throw new e.OAuthUserInfoFailed.Error();
    }

    // Extract email
    const email = String(data[mapping.email] ?? '');
    const emailVerified = mapping.email_verified
      ? parseEmailVerified(data[mapping.email_verified])
      : true; // Default to true for OAuth providers

    if (!email) {
      throw new e.OAuthUserInfoFailed.Error();
    }

    const name = mapping.name ? String(data[mapping.name] ?? '') : undefined;
    const picture = mapping.picture
      ? String(data[mapping.picture] ?? '')
      : undefined;

    return {
      id,
      email,
      email_verified: emailVerified,
      name: name || undefined,
      picture: picture || undefined,
    };
  }

  /**
   * Authenticate with OAuth - login or register user
   */
  public async authenticateWithOAuth(
    providerId: string,
    tokens: OAuthTokens,
    userInfo: OAuthUserInfo,
  ): Promise<OAuthAuthResult> {
    const provider = this.getProvider(providerId);

    // Reject if the OAuth provider has not verified the user's email
    if (!userInfo.email_verified) {
      throw new e.OAuthEmailNotVerified.Error();
    }

    // Check if OAuth account is already linked
    const existingOAuth = await this.mikro.userOAuth.findByProviderUserId(
      providerId,
      userInfo.id,
    );

    if (existingOAuth) {
      // Update tokens and return existing user
      await this.mikro.userOAuth.updateTokens(existingOAuth, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
      });

      // Load user entity from Ref
      const user = await existingOAuth.user.load({
        populate: ['password_hash'],
      });
      if (!user) {
        throw new e.UserNotFound.Error();
      }

      return {
        isNewUser: false,
        user: await this.userService.getSessionUserBySub(user.sub),
      };
    }

    // Check if user with same email exists in database
    // Config users are now synced to DB, so we only need to check the database
    const existingUser = await this.mikro.user.findOne({
      email: userInfo.email,
    });

    if (existingUser) {
      // Handle email conflict based on strategy
      if (provider.email_conflict_strategy === 'require_link') {
        throw new e.OAuthEmailConflict.Error();
      }

      // auto_link strategy - link to existing user if email is verified
      if (!existingUser.email_verified) {
        // Mark email as verified since OAuth provider verified it
        existingUser.email_verified = true;
      }

      // Link OAuth account (only for database-managed users)
      // Config-managed users can still be linked since they're in DB now
      await this.mikro.userOAuth.linkAccount({
        userSub: existingUser.sub,
        providerName: providerId,
        providerUserId: userInfo.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
      });

      await this.mikro.em.flush();

      return {
        isNewUser: false,
        user: await this.userService.getSessionUserBySub(existingUser.sub),
      };
    }

    // Check if registration is enabled and email is allowed
    if (!this.config.registration.enabled) {
      throw new e.RegistrationDisabled.Error();
    }
    if (
      this.config.registration.allowed_email_patterns.length > 0 &&
      !isEmailAllowed(
        userInfo.email,
        this.config.registration.allowed_email_patterns,
      )
    ) {
      throw new e.RegistrationEmailNotAllowed.Error();
    }

    // Create new user with OAuth
    const newUser = this.mikro.user.create({
      email: userInfo.email,
      password_hash: null, // No password for OAuth-only users
    });
    newUser.email_verified = true; // OAuth provider verified the email

    this.mikro.em.persist(newUser);

    // Link OAuth account
    await this.mikro.userOAuth.linkAccount({
      userSub: newUser.sub,
      providerName: providerId,
      providerUserId: userInfo.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
    });

    await this.mikro.em.flush();

    // Record implicit consents automatically for OAuth users
    // Explicit terms consent is handled in /terms page if any explicit terms exist
    await this.termsService.recordImplicitConsents({
      userSub: newUser.sub,
    });

    return {
      isNewUser: true,
      user: await this.userService.getSessionUserBySub(newUser.sub),
    };
  }

  /**
   * Check if a user would be new (not existing) for OAuth authentication
   * Used to determine if we should defer registration until terms consent
   */
  public async isNewOAuthUser(
    providerId: string,
    userInfo: OAuthUserInfo,
  ): Promise<boolean> {
    // Check if OAuth account is already linked
    const existingOAuth = await this.mikro.userOAuth.findByProviderUserId(
      providerId,
      userInfo.id,
    );

    if (existingOAuth) {
      return false;
    }

    // Check if user with same email exists in database
    const existingUser = await this.mikro.user.findOne({
      email: userInfo.email,
    });

    return !existingUser;
  }

  /**
   * Complete OAuth registration with terms consent
   * Called after user agrees to terms on /terms page
   * This creates the user in DB only after consent is given (GDPR compliant)
   */
  public async completeOAuthRegistration(params: {
    providerId: string;
    tokens: OAuthTokens;
    userInfo: OAuthUserInfo;
    consents: Array<{ termsId: string; agreed: boolean }>;
  }): Promise<OAuthAuthResult> {
    const { providerId, tokens, userInfo, consents } = params;

    // Reject if the OAuth provider has not verified the user's email
    if (!userInfo.email_verified) {
      throw new e.OAuthEmailNotVerified.Error();
    }

    // Double-check that user doesn't exist (in case of race condition)
    const existingOAuth = await this.mikro.userOAuth.findByProviderUserId(
      providerId,
      userInfo.id,
    );

    if (existingOAuth) {
      // User was created in the meantime, just return existing user
      const user = await existingOAuth.user.load({
        populate: ['password_hash'],
      });
      if (!user) {
        throw new e.UserNotFound.Error();
      }

      return {
        isNewUser: false,
        user: await this.userService.getSessionUserBySub(user.sub),
      };
    }

    // Check if user with same email exists
    const existingUser = await this.mikro.user.findOne({
      email: userInfo.email,
    });

    if (existingUser) {
      // Handle as auto_link - link OAuth to existing user
      const provider = this.getProvider(providerId);

      if (provider.email_conflict_strategy === 'require_link') {
        throw new e.OAuthEmailConflict.Error();
      }

      if (!existingUser.email_verified) {
        existingUser.email_verified = true;
      }

      await this.mikro.userOAuth.linkAccount({
        userSub: existingUser.sub,
        providerName: providerId,
        providerUserId: userInfo.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
      });

      // Record all consents for existing user (load terms once)
      const terms = await this.termsService.getGlobalTerms();
      await this.termsService.recordConsents({
        userSub: existingUser.sub,
        consents,
        terms,
      });
      await this.termsService.recordImplicitConsents({
        userSub: existingUser.sub,
        terms,
      });

      await this.mikro.em.flush();

      return {
        isNewUser: false,
        user: await this.userService.getSessionUserBySub(existingUser.sub),
      };
    }

    // Check if registration is enabled and email is allowed
    if (!this.config.registration.enabled) {
      throw new e.RegistrationDisabled.Error();
    }
    if (
      this.config.registration.allowed_email_patterns.length > 0 &&
      !isEmailAllowed(
        userInfo.email,
        this.config.registration.allowed_email_patterns,
      )
    ) {
      throw new e.RegistrationEmailNotAllowed.Error();
    }

    // Create new user with OAuth
    const newUser = this.mikro.user.create({
      email: userInfo.email,
      password_hash: null,
    });
    newUser.email_verified = true;

    this.mikro.em.persist(newUser);

    // Link OAuth account
    await this.mikro.userOAuth.linkAccount({
      userSub: newUser.sub,
      providerName: providerId,
      providerUserId: userInfo.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
    });

    await this.mikro.em.flush();

    // Record all consents (load terms once)
    const terms = await this.termsService.getGlobalTerms();
    await this.termsService.recordConsents({
      userSub: newUser.sub,
      consents,
      terms,
    });
    await this.termsService.recordImplicitConsents({
      userSub: newUser.sub,
      terms,
    });

    return {
      isNewUser: true,
      user: await this.userService.getSessionUserBySub(newUser.sub),
    };
  }

  /**
   * Link OAuth account to existing user
   */
  public async linkOAuthAccount(
    userSub: string,
    providerId: string,
    tokens: OAuthTokens,
    userInfo: OAuthUserInfo,
  ): Promise<void> {
    // Check if OAuth account is already linked to another user
    const existingOAuth = await this.mikro.userOAuth.findByProviderUserId(
      providerId,
      userInfo.id,
    );

    if (existingOAuth && existingOAuth.user.sub !== userSub) {
      throw new e.OAuthAccountAlreadyLinked.Error();
    }

    // Get user
    const user = await this.mikro.user.findOneOrFail(
      { sub: userSub },
      { failHandler: () => new e.UserNotFound.Error() },
    );

    // Check if already linked
    const existingLink = await this.mikro.userOAuth.findByUserAndProvider(
      userSub,
      providerId,
    );

    if (existingLink) {
      // Update tokens
      await this.mikro.userOAuth.updateTokens(existingLink, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
      });
      return;
    }

    // Link OAuth account
    await this.mikro.userOAuth.linkAccount({
      userSub: user.sub,
      providerName: providerId,
      providerUserId: userInfo.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
    });
  }

  /**
   * Unlink OAuth account from user
   */
  public async unlinkOAuthAccount(
    userSub: string,
    providerId: string,
  ): Promise<void> {
    // Get user from database (config users are now synced to DB)
    const user = await this.mikro.user.findOneOrFail(
      { sub: userSub },
      {
        failHandler: () => new e.UserNotFound.Error(),
        populate: ['password_hash'],
      },
    );

    // Check if OAuth account is linked
    const oauthAccount = await this.mikro.userOAuth.findByUserAndProvider(
      userSub,
      providerId,
    );

    if (!oauthAccount) {
      throw new e.OAuthAccountNotLinked.Error();
    }

    // Check if this is the last auth method
    const oauthCount = await this.mikro.userOAuth.countByUser(userSub);
    const hasPassword = user.hasPassword();

    // If only one OAuth and no password, can't unlink
    if (oauthCount <= 1 && !hasPassword) {
      throw new e.CannotUnlinkLastAuthMethod.Error();
    }

    await this.mikro.userOAuth.unlinkAccount(userSub, providerId);
  }

  /**
   * Get all OAuth accounts linked to a user
   */
  public async getLinkedAccounts(
    userSub: string,
  ): Promise<Array<{ provider_name: string; linked_at: Date }>> {
    // Get user from database (config users are now synced to DB)
    await this.mikro.user.findOneOrFail(
      { sub: userSub },
      { failHandler: () => new e.UserNotFound.Error() },
    );

    const oauthAccounts = await this.mikro.userOAuth.findByUser(userSub);

    return oauthAccounts.map((account) => ({
      provider_name: account.provider_name,
      linked_at: account.created_at,
    }));
  }
}

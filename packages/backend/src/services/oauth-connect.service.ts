import fastifyPlugin from 'fastify-plugin';
import type z from 'zod/v4';
import {
  type InternalAppConfig,
  type ResolvedOAuthConfig,
  resolveOAuthConfig,
} from '@/lib/config/index.js';
import { generatePKCE } from '@/lib/pkce.js';
import type { MikroService } from '@/plugins/mikro-orm.js';
import { e } from '@/schemas/error.js';
import type { oauthConnectSchema } from '@/schemas/oauth-connect.js';
import type { TermsService } from './terms.service.js';
import type { UserService } from './user.service.js';

// Note: This service uses fastify.config for oauth_authentication_methods (OAuth providers config)
// but user-related config lookups have been removed since users are now synced to DB.

declare module 'fastify' {
  interface FastifyInstance {
    oauthConnectService: OAuthConnectService;
  }
}

export class OAuthConnectService {
  public constructor(
    private readonly config: InternalAppConfig,
    private readonly userService: UserService,
    private readonly mikro: MikroService,
    private readonly termsService: TermsService,
  ) {}

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

    for (const config of this.config.oauth_authentication_methods) {
      if (config.enabled) {
        const resolved = resolveOAuthConfig(config);
        providers.push({
          id: resolved.id,
          display_name: resolved.display_name,
          icon_url: resolved.icon_url,
        });
      }
    }

    return providers;
  }

  /**
   * Get OAuth provider config by id
   */
  public getProvider(id: string): ResolvedOAuthConfig {
    const config = this.config.oauth_authentication_methods.find(
      (c) => c.id === id,
    );

    if (!config || !config.enabled) {
      throw new e.OAuthProviderNotFound.Error();
    }

    return resolveOAuthConfig(config);
  }

  /**
   * Generate authorization URL with state and PKCE
   */
  public async generateAuthorizationUrl(
    providerId: string,
    mode: 'login' | 'register' | 'link',
    returnUrl?: string,
  ): Promise<{
    url: string;
    sessionData: z.infer<typeof oauthConnectSchema.OAuthSessionData>;
  }> {
    const provider = this.getProvider(providerId);
    const pkce = await generatePKCE();
    const state = crypto.randomUUID();

    const params = new URLSearchParams({
      client_id: provider.client_id,
      redirect_uri: `${this.config.app.host}/api/v1/oauth/${providerId}/callback`,
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

    const sessionData: z.infer<typeof oauthConnectSchema.OAuthSessionData> = {
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
  ): Promise<z.infer<typeof oauthConnectSchema.OAuthTokens>> {
    const provider = this.getProvider(providerId);

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${this.config.app.host}/api/v1/oauth/${providerId}/callback`,
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

    const tokens = (await response.json()) as z.infer<
      typeof oauthConnectSchema.OAuthTokens
    >;
    return tokens;
  }

  /**
   * Fetch user info from OAuth provider
   */
  public async fetchUserInfo(
    providerId: string,
    accessToken: string,
  ): Promise<z.infer<typeof oauthConnectSchema.OAuthUserInfo>> {
    const provider = this.getProvider(providerId);

    // Apple doesn't have a userinfo endpoint - info is in the ID token
    if (!provider.userinfo_url) {
      throw new e.OAuthUserInfoFailed.Error();
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

    const data = (await response.json()) as Record<string, unknown>;
    const mapping = provider.userinfo_mapping;

    // Extract user ID
    const id = String(data[mapping.id] ?? '');
    if (!id) {
      throw new e.OAuthUserInfoFailed.Error();
    }

    // Extract email
    const email = String(data[mapping.email] ?? '');
    const emailVerified = mapping.email_verified
      ? Boolean(data[mapping.email_verified])
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
    tokens: z.infer<typeof oauthConnectSchema.OAuthTokens>,
    userInfo: z.infer<typeof oauthConnectSchema.OAuthUserInfo>,
  ): Promise<z.infer<typeof oauthConnectSchema.OAuthAuthResult>> {
    const provider = this.getProvider(providerId);

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

      // Compute totp_registered from userTotp repository
      const totpRegistered = await this.mikro.userTotp.isRegistered(user.id);
      const secondFactorRequired =
        user.managed_by === 'config'
          ? false
          : this.config.basic_authentication_methods.password.second_factor
              .required;

      return {
        isNewUser: false,
        user: {
          id: user.id,
          managed_by: 'database',
          email: user.email,
          email_verified: user.email_verified,
          email_verification_required:
            this.userService.userEmailVerificationRequired(user),
          has_password: user.hasPassword(),
          totp_registered: totpRegistered,
          second_factor_required: secondFactorRequired,
          passkey_count: await this.mikro.userPasskey.countByUserId(user.id),
        },
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
        userId: existingUser.id,
        providerName: providerId,
        providerUserId: userInfo.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
      });

      await this.mikro.em.flush();

      // Compute totp_registered from userTotp repository
      const totpRegistered = await this.mikro.userTotp.isRegistered(
        existingUser.id,
      );
      const secondFactorRequired =
        existingUser.managed_by === 'config'
          ? false
          : this.config.basic_authentication_methods.password.second_factor
              .required;

      await this.mikro.em.populate(existingUser, ['password_hash']);
      return {
        isNewUser: false,
        user: {
          id: existingUser.id,
          managed_by: existingUser.managed_by,
          email: existingUser.email,
          email_verified: existingUser.email_verified,
          email_verification_required:
            this.userService.userEmailVerificationRequired(existingUser),
          has_password: existingUser.hasPassword(),
          totp_registered: totpRegistered,
          second_factor_required: secondFactorRequired,
          passkey_count: await this.mikro.userPasskey.countByUserId(
            existingUser.id,
          ),
        },
      };
    }

    // Create new user with OAuth
    const newUser = this.mikro.user.create({
      email: userInfo.email,
      password_hash: null, // No password for OAuth-only users
    });
    newUser.email_verified = true; // OAuth provider verified the email

    await this.mikro.em.persist(newUser);

    // Link OAuth account
    await this.mikro.userOAuth.linkAccount({
      userId: newUser.id,
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
    await this.termsService.recordImplicitConsents({ userId: newUser.id });

    return {
      isNewUser: true,
      user: {
        id: newUser.id,
        managed_by: 'database',
        email: newUser.email,
        email_verified: newUser.email_verified,
        email_verification_required:
          this.userService.userEmailVerificationRequired(newUser),
        has_password: newUser.hasPassword(),
        totp_registered: false, // New user has no TOTP
        second_factor_required:
          this.config.basic_authentication_methods.password.second_factor
            .required,
        passkey_count: 0, // New user has no passkeys
      },
    };
  }

  /**
   * Check if a user would be new (not existing) for OAuth authentication
   * Used to determine if we should defer registration until terms consent
   */
  public async isNewOAuthUser(
    providerId: string,
    userInfo: z.infer<typeof oauthConnectSchema.OAuthUserInfo>,
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
    tokens: z.infer<typeof oauthConnectSchema.OAuthTokens>;
    userInfo: z.infer<typeof oauthConnectSchema.OAuthUserInfo>;
    consents: Array<{ termsId: string; agreed: boolean }>;
  }): Promise<z.infer<typeof oauthConnectSchema.OAuthAuthResult>> {
    const { providerId, tokens, userInfo, consents } = params;

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

      const totpRegistered = await this.mikro.userTotp.isRegistered(user.id);
      const secondFactorRequired =
        user.managed_by === 'config'
          ? false
          : this.config.basic_authentication_methods.password.second_factor
              .required;

      return {
        isNewUser: false,
        user: {
          id: user.id,
          managed_by: 'database',
          email: user.email,
          email_verified: user.email_verified,
          email_verification_required:
            this.userService.userEmailVerificationRequired(user),
          has_password: user.hasPassword(),
          totp_registered: totpRegistered,
          second_factor_required: secondFactorRequired,
          passkey_count: await this.mikro.userPasskey.countByUserId(user.id),
        },
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
        userId: existingUser.id,
        providerName: providerId,
        providerUserId: userInfo.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
      });

      // Record consents for existing user
      await this.termsService.recordConsents({
        userId: existingUser.id,
        consents,
      });

      // Also record implicit consents
      await this.termsService.recordImplicitConsents({
        userId: existingUser.id,
      });

      await this.mikro.em.flush();

      const totpRegistered = await this.mikro.userTotp.isRegistered(
        existingUser.id,
      );
      const secondFactorRequired =
        existingUser.managed_by === 'config'
          ? false
          : this.config.basic_authentication_methods.password.second_factor
              .required;

      await this.mikro.em.populate(existingUser, ['password_hash']);

      return {
        isNewUser: false,
        user: {
          id: existingUser.id,
          managed_by: existingUser.managed_by,
          email: existingUser.email,
          email_verified: existingUser.email_verified,
          email_verification_required:
            this.userService.userEmailVerificationRequired(existingUser),
          has_password: existingUser.hasPassword(),
          totp_registered: totpRegistered,
          second_factor_required: secondFactorRequired,
          passkey_count: await this.mikro.userPasskey.countByUserId(
            existingUser.id,
          ),
        },
      };
    }

    // Create new user with OAuth
    const newUser = this.mikro.user.create({
      email: userInfo.email,
      password_hash: null,
    });
    newUser.email_verified = true;

    await this.mikro.em.persist(newUser);

    // Link OAuth account
    await this.mikro.userOAuth.linkAccount({
      userId: newUser.id,
      providerName: providerId,
      providerUserId: userInfo.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
    });

    await this.mikro.em.flush();

    // Record explicit consents (from user's checkbox selections)
    await this.termsService.recordConsents({
      userId: newUser.id,
      consents,
    });

    // Record implicit consents automatically
    await this.termsService.recordImplicitConsents({ userId: newUser.id });

    return {
      isNewUser: true,
      user: {
        id: newUser.id,
        managed_by: 'database',
        email: newUser.email,
        email_verified: newUser.email_verified,
        email_verification_required:
          this.userService.userEmailVerificationRequired(newUser),
        has_password: newUser.hasPassword(),
        totp_registered: false,
        second_factor_required:
          this.config.basic_authentication_methods.password.second_factor
            .required,
        passkey_count: 0,
      },
    };
  }

  /**
   * Link OAuth account to existing user
   */
  public async linkOAuthAccount(
    userId: string,
    providerId: string,
    tokens: z.infer<typeof oauthConnectSchema.OAuthTokens>,
    userInfo: z.infer<typeof oauthConnectSchema.OAuthUserInfo>,
  ): Promise<void> {
    // Check if OAuth account is already linked to another user
    const existingOAuth = await this.mikro.userOAuth.findByProviderUserId(
      providerId,
      userInfo.id,
    );

    if (existingOAuth && existingOAuth.user.id !== userId) {
      throw new e.OAuthAccountAlreadyLinked.Error();
    }

    // Get user
    const user = await this.mikro.user.findOneOrFail(
      { id: userId },
      { failHandler: () => new e.UserNotFound.Error() },
    );

    // Check if already linked
    const existingLink = await this.mikro.userOAuth.findByUserAndProvider(
      userId,
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
      userId: user.id,
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
    userId: string,
    providerId: string,
  ): Promise<void> {
    // Get user from database (config users are now synced to DB)
    const user = await this.mikro.user.findOneOrFail(
      { id: userId },
      {
        failHandler: () => new e.UserNotFound.Error(),
        populate: ['password_hash'],
      },
    );

    // Check if OAuth account is linked
    const oauthAccount = await this.mikro.userOAuth.findByUserAndProvider(
      userId,
      providerId,
    );

    if (!oauthAccount) {
      throw new e.OAuthAccountNotLinked.Error();
    }

    // Check if this is the last auth method
    const oauthCount = await this.mikro.userOAuth.countByUser(userId);
    const hasPassword = user.hasPassword();

    // If only one OAuth and no password, can't unlink
    if (oauthCount <= 1 && !hasPassword) {
      throw new e.CannotUnlinkLastAuthMethod.Error();
    }

    await this.mikro.userOAuth.unlinkAccount(userId, providerId);
  }

  /**
   * Get all OAuth accounts linked to a user
   */
  public async getLinkedAccounts(
    userId: string,
  ): Promise<Array<{ provider_name: string; linked_at: Date }>> {
    // Get user from database (config users are now synced to DB)
    await this.mikro.user.findOneOrFail(
      { id: userId },
      { failHandler: () => new e.UserNotFound.Error() },
    );

    const oauthAccounts = await this.mikro.userOAuth.findByUser(userId);

    return oauthAccounts.map((account) => ({
      provider_name: account.provider_name,
      linked_at: account.created_at,
    }));
  }
}

export default fastifyPlugin(
  async (fastify) => {
    const oauthConnectService = new OAuthConnectService(
      fastify.config,
      fastify.userService,
      fastify.mikro,
      fastify.termsService,
    );
    fastify.decorate('oauthConnectService', oauthConnectService);
  },
  {
    name: 'oauth-connect-service-plugin',
    dependencies: [
      'base-service-plugin',
      'user-service-plugin',
      'terms-service-plugin',
    ],
  },
);

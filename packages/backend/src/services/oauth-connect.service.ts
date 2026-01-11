import fastifyPlugin from 'fastify-plugin';
import {
  AppConfigs,
  resolveOAuthConfig,
  type AppConfigAuthMethodOAuth,
  type ResolvedOAuthConfig,
} from '@/lib/config.js';
import { generatePKCE } from '@/lib/pkce.js';
import type { MikroService } from '@/plugins/mikro-orm.js';
import { e } from '@/schemas/error.js';
import type { r } from '@/schemas/response.js';
import type z from 'zod';

declare module 'fastify' {
  interface FastifyInstance {
    oauthConnectService: OAuthConnectService;
  }
}

/**
 * OAuth user info returned from provider
 */
export interface OAuthUserInfo {
  id: string;
  email: string;
  email_verified: boolean;
  name?: string | undefined;
  picture?: string | undefined;
}

/**
 * Token response from OAuth provider
 */
export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  id_token?: string;
}

/**
 * OAuth session data stored in secure session
 */
export interface OAuthSessionData {
  state: string;
  codeVerifier: string;
  providerName: string;
  mode: 'login' | 'register' | 'link';
  returnUrl?: string | undefined;
}

/**
 * Result of OAuth authentication
 */
export interface OAuthAuthResult {
  isNewUser: boolean;
  user: z.infer<typeof r.UserSession>;
}

export class OAuthConnectService {
  public constructor(private readonly mikro: MikroService) {}

  /**
   * Get all enabled OAuth providers
   */
  public getEnabledProviders(): Array<{
    name: string;
    display_name: string;
    icon_url?: string | undefined;
  }> {
    const providers: Array<{
      name: string;
      display_name: string;
      icon_url?: string | undefined;
    }> = [];

    for (const [name, config] of Object.entries(
      AppConfigs.authentication_methods,
    )) {
      if (config.type === 'oauth' && config.enabled) {
        const resolved = resolveOAuthConfig(
          name,
          config as AppConfigAuthMethodOAuth,
        );
        providers.push({
          name: resolved.name,
          display_name: resolved.display_name,
          icon_url: resolved.icon_url,
        });
      }
    }

    return providers;
  }

  /**
   * Get OAuth provider config by name
   */
  public getProvider(name: string): ResolvedOAuthConfig {
    const config = AppConfigs.authentication_methods[name];

    if (!config || config.type !== 'oauth' || !config.enabled) {
      throw new e.OAuthProviderNotFound.Error();
    }

    return resolveOAuthConfig(name, config);
  }

  /**
   * Generate authorization URL with state and PKCE
   */
  public async generateAuthorizationUrl(
    providerName: string,
    mode: 'login' | 'register' | 'link',
    returnUrl?: string,
  ): Promise<{ url: string; sessionData: OAuthSessionData }> {
    const provider = this.getProvider(providerName);
    const pkce = await generatePKCE();
    const state = crypto.randomUUID();

    const params = new URLSearchParams({
      client_id: provider.client_id,
      redirect_uri: `${AppConfigs.app.host}/api/v1/oauth/callback/${providerName}`,
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
      providerName,
      mode,
      returnUrl,
    };

    return { url, sessionData };
  }

  /**
   * Exchange authorization code for tokens
   */
  public async exchangeCodeForTokens(
    providerName: string,
    code: string,
    codeVerifier: string,
  ): Promise<OAuthTokens> {
    const provider = this.getProvider(providerName);

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${AppConfigs.app.host}/api/v1/oauth/callback/${providerName}`,
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

    const tokens = (await response.json()) as OAuthTokens;
    return tokens;
  }

  /**
   * Fetch user info from OAuth provider
   */
  public async fetchUserInfo(
    providerName: string,
    accessToken: string,
  ): Promise<OAuthUserInfo> {
    const provider = this.getProvider(providerName);

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

    // Extract email - may need separate API call for some providers (e.g., GitHub)
    let email = String(data[mapping.email] ?? '');
    let emailVerified = mapping.email_verified
      ? Boolean(data[mapping.email_verified])
      : false;

    // GitHub requires separate API call for emails
    if (provider.email_url && !email) {
      const emailData = await this.fetchGitHubEmails(
        provider.email_url,
        accessToken,
      );
      if (emailData) {
        email = emailData.email;
        emailVerified = emailData.verified;
      }
    }

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
   * Fetch emails from GitHub API (required for GitHub OAuth)
   */
  private async fetchGitHubEmails(
    emailUrl: string,
    accessToken: string,
  ): Promise<{ email: string; verified: boolean } | null> {
    const response = await fetch(emailUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const emails = (await response.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;

    // Find primary verified email
    const primaryEmail = emails.find((e) => e.primary && e.verified);
    if (primaryEmail) {
      return { email: primaryEmail.email, verified: true };
    }

    // Fall back to any verified email
    const verifiedEmail = emails.find((e) => e.verified);
    if (verifiedEmail) {
      return { email: verifiedEmail.email, verified: true };
    }

    // Fall back to primary email even if not verified
    const anyPrimary = emails.find((e) => e.primary);
    if (anyPrimary) {
      return { email: anyPrimary.email, verified: anyPrimary.verified };
    }

    return null;
  }

  /**
   * Authenticate with OAuth - login or register user
   */
  public async authenticateWithOAuth(
    providerName: string,
    tokens: OAuthTokens,
    userInfo: OAuthUserInfo,
  ): Promise<OAuthAuthResult> {
    const provider = this.getProvider(providerName);

    // Require verified email
    if (!userInfo.email_verified) {
      throw new e.OAuthEmailNotVerified.Error();
    }

    // Check if OAuth account is already linked
    const existingOAuth = await this.mikro.userOAuth.findByProviderUserId(
      providerName,
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

      const user = existingOAuth.user;
      return {
        isNewUser: false,
        user: {
          id: user.id,
          managed: 'database',
          email: user.email,
          email_verified: user.email_verified,
        },
      };
    }

    // Check if user with same email exists
    const existingUser = await this.mikro.user.findOne({
      email: userInfo.email,
    });

    // Also check config users
    const configUser = AppConfigs.users?.find(
      (u) => u.email === userInfo.email,
    );

    if (existingUser || configUser) {
      // Handle email conflict based on strategy
      if (provider.email_conflict_strategy === 'require_link') {
        throw new e.OAuthEmailConflict.Error();
      }

      // auto_link strategy - link to existing user if email is verified
      if (existingUser) {
        if (!existingUser.email_verified) {
          // Mark email as verified since OAuth provider verified it
          existingUser.email_verified = true;
        }

        // Link OAuth account
        await this.mikro.userOAuth.linkAccount({
          user: existingUser,
          providerName,
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
          user: {
            id: existingUser.id,
            managed: 'database',
            email: existingUser.email,
            email_verified: existingUser.email_verified,
          },
        };
      }

      // Config user - can't link, just return session
      if (configUser) {
        return {
          isNewUser: false,
          user: {
            id: configUser.id,
            managed: 'config',
            email: configUser.email,
            email_verified: true,
          },
        };
      }
    }

    // Create new user with OAuth
    const newUser = this.mikro.user.create({
      email: userInfo.email,
      password_hash: crypto.randomUUID(), // Random password since user will use OAuth
    });
    newUser.email_verified = true; // OAuth provider verified the email

    await this.mikro.em.persist(newUser);

    // Link OAuth account
    await this.mikro.userOAuth.linkAccount({
      user: newUser,
      providerName,
      providerUserId: userInfo.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
    });

    await this.mikro.em.flush();

    return {
      isNewUser: true,
      user: {
        id: newUser.id,
        managed: 'database',
        email: newUser.email,
        email_verified: newUser.email_verified,
      },
    };
  }

  /**
   * Link OAuth account to existing user
   */
  public async linkOAuthAccount(
    userId: string,
    providerName: string,
    tokens: OAuthTokens,
    userInfo: OAuthUserInfo,
  ): Promise<void> {
    // Check if OAuth account is already linked to another user
    const existingOAuth = await this.mikro.userOAuth.findByProviderUserId(
      providerName,
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
      user,
      providerName,
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
      user,
      providerName,
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
    providerName: string,
  ): Promise<void> {
    // Get user
    const user = await this.mikro.user.findOneOrFail(
      { id: userId },
      {
        failHandler: () => new e.UserNotFound.Error(),
        populate: ['password_hash'],
      },
    );

    // Check if OAuth account is linked
    const oauthAccount = await this.mikro.userOAuth.findByUserAndProvider(
      user,
      providerName,
    );

    if (!oauthAccount) {
      throw new e.OAuthAccountNotLinked.Error();
    }

    // Check if this is the last auth method
    const oauthCount = await this.mikro.userOAuth.countByUser(user);
    const hasPassword = !!user.password_hash;

    // If only one OAuth and no password, can't unlink
    if (oauthCount <= 1 && !hasPassword) {
      throw new e.CannotUnlinkLastAuthMethod.Error();
    }

    await this.mikro.userOAuth.unlinkAccount(user, providerName);
  }

  /**
   * Get all OAuth accounts linked to a user
   */
  public async getLinkedAccounts(
    userId: string,
  ): Promise<Array<{ provider_name: string; linked_at: Date }>> {
    // Check if user exists in config (config users can't have linked accounts)
    const configUser = AppConfigs.users?.find((u) => u.id === userId);
    if (configUser) {
      // Config users don't have OAuth linked accounts
      return [];
    }

    const user = await this.mikro.user.findOneOrFail(
      { id: userId },
      { failHandler: () => new e.UserNotFound.Error() },
    );

    const oauthAccounts = await this.mikro.userOAuth.findByUser(user);

    return oauthAccounts.map((account) => ({
      provider_name: account.provider_name,
      linked_at: account.created_at,
    }));
  }
}

export default fastifyPlugin(
  async (fastify) => {
    const oauthConnectService = new OAuthConnectService(fastify.mikro);
    fastify.decorate('oauthConnectService', oauthConnectService);
  },
  {
    name: 'oauth-connect-service-plugin',
    dependencies: ['base-service-plugin'],
  },
);

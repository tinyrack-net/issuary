import { EntityRepository } from '@mikro-orm/core';
import type { UserEntity } from '@/entities/user.entity.js';
import type { UserOAuthEntity } from '@/entities/user-oauth.entity.js';

export class UserOAuthRepository extends EntityRepository<UserOAuthEntity> {
  /**
   * Find OAuth account by provider name and provider user ID
   *
   * @param providerName - Name of the OAuth provider (e.g., "google", "github")
   * @param providerUserId - Unique user ID from the OAuth provider
   * @returns OAuth account entity or null if not found
   */
  async findByProviderUserId(
    providerName: string,
    providerUserId: string,
  ): Promise<UserOAuthEntity | null> {
    return this.findOne({
      provider_name: providerName,
      provider_user_id: providerUserId,
    });
  }

  /**
   * Find OAuth account by provider name and user
   *
   * @param user - User entity
   * @param providerName - Name of the OAuth provider
   * @returns OAuth account entity or null if not found
   */
  async findByUserAndProvider(
    user: UserEntity,
    providerName: string,
  ): Promise<UserOAuthEntity | null> {
    return this.findOne({
      user,
      provider_name: providerName,
    });
  }

  /**
   * Find all OAuth accounts linked to a user
   *
   * @param user - User entity
   * @returns Array of OAuth account entities
   */
  async findByUser(user: UserEntity): Promise<UserOAuthEntity[]> {
    return this.find({ user });
  }

  /**
   * Check if an OAuth account is already linked to any user
   *
   * @param providerName - Name of the OAuth provider
   * @param providerUserId - Unique user ID from the OAuth provider
   * @returns True if OAuth account is linked to a user
   */
  async isLinked(
    providerName: string,
    providerUserId: string,
  ): Promise<boolean> {
    const count = await this.count({
      provider_name: providerName,
      provider_user_id: providerUserId,
    });
    return count > 0;
  }

  /**
   * Link an OAuth account to a user
   *
   * @param params - OAuth account data
   * @returns Newly created OAuth account entity
   */
  async linkAccount(params: {
    user: UserEntity;
    providerName: string;
    providerUserId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date | null;
  }): Promise<UserOAuthEntity> {
    const oauthAccount = this.create({
      user: params.user,
      provider_name: params.providerName,
      provider_user_id: params.providerUserId,
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
      expires_at: params.expiresAt,
    });

    await this.getEntityManager().persistAndFlush(oauthAccount);
    return oauthAccount;
  }

  /**
   * Update tokens for an existing OAuth account
   *
   * @param oauthAccount - OAuth account entity to update
   * @param tokens - New token values
   */
  async updateTokens(
    oauthAccount: UserOAuthEntity,
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: Date | null;
    },
  ): Promise<void> {
    oauthAccount.access_token = tokens.accessToken;
    oauthAccount.refresh_token = tokens.refreshToken;
    oauthAccount.expires_at = tokens.expiresAt;

    await this.getEntityManager().persistAndFlush(oauthAccount);
  }

  /**
   * Unlink an OAuth account from a user
   *
   * @param user - User entity
   * @param providerName - Name of the OAuth provider to unlink
   * @returns True if account was unlinked, false if not found
   */
  async unlinkAccount(
    user: UserEntity,
    providerName: string,
  ): Promise<boolean> {
    const oauthAccount = await this.findByUserAndProvider(user, providerName);
    if (!oauthAccount) {
      return false;
    }

    await this.getEntityManager().removeAndFlush(oauthAccount);
    return true;
  }

  /**
   * Count the number of OAuth accounts linked to a user
   *
   * @param user - User entity
   * @returns Number of linked OAuth accounts
   */
  async countByUser(user: UserEntity): Promise<number> {
    return this.count({ user });
  }
}

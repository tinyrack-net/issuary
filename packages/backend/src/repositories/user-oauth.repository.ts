import { UserEntity } from '@backend/entities/user.entity.js';
import { UserOAuthEntity } from '@backend/entities/user-oauth.entity.js';
import { EntityRepository, ref } from '@mikro-orm/core';

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
   * Find OAuth account by provider name and user ID
   *
   * @param userId - User ID
   * @param providerName - Name of the OAuth provider
   * @returns OAuth account entity or null if not found
   */
  async findByUserAndProvider(
    userId: string,
    providerName: string,
  ): Promise<UserOAuthEntity | null> {
    return this.findOne({
      user: ref(UserEntity, userId),
      provider_name: providerName,
    });
  }

  /**
   * Find all OAuth accounts linked to a user
   *
   * @param userId - User ID
   * @returns Array of OAuth account entities
   */
  async findByUser(userId: string): Promise<UserOAuthEntity[]> {
    return this.find({ user: ref(UserEntity, userId) });
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
    userId: string;
    providerName: string;
    providerUserId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date | null;
  }): Promise<UserOAuthEntity> {
    const oauthAccount = new UserOAuthEntity({
      userId: params.userId,
      provider_name: params.providerName,
      provider_user_id: params.providerUserId,
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
      expires_at: params.expiresAt,
    });

    await this.getEntityManager().persist(oauthAccount).flush();
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

    await this.getEntityManager().persist(oauthAccount).flush();
  }

  /**
   * Unlink an OAuth account from a user
   *
   * @param userId - User ID
   * @param providerName - Name of the OAuth provider to unlink
   * @returns True if account was unlinked, false if not found
   */
  async unlinkAccount(userId: string, providerName: string): Promise<boolean> {
    const oauthAccount = await this.findByUserAndProvider(userId, providerName);
    if (!oauthAccount) {
      return false;
    }

    await this.getEntityManager().remove(oauthAccount).flush();
    return true;
  }

  /**
   * Count the number of OAuth accounts linked to a user
   *
   * @param userId - User ID
   * @returns Number of linked OAuth accounts
   */
  async countByUser(userId: string): Promise<number> {
    return this.count({ user: ref(UserEntity, userId) });
  }
}

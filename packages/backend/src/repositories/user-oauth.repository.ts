import { UserEntity } from '@backend/entities/user.entity.js';
import type { IUserOAuthEntity } from '@backend/entities/user-oauth.entity.js';
import { EntityRepository, ref } from '@mikro-orm/core';

export class UserOAuthRepository extends EntityRepository<IUserOAuthEntity> {
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
  ): Promise<IUserOAuthEntity | null> {
    return this.findOne({
      provider_name: providerName,
      provider_user_id: providerUserId,
    });
  }

  /**
   * Find OAuth account by provider name and user sub
   *
   * @param userSub - User sub
   * @param providerName - Name of the OAuth provider
   * @returns OAuth account entity or null if not found
   */
  async findByUserAndProvider(
    userSub: string,
    providerName: string,
  ): Promise<IUserOAuthEntity | null> {
    return this.findOne({
      user: ref(UserEntity, userSub),
      provider_name: providerName,
    });
  }

  /**
   * Find all OAuth accounts linked to a user
   *
   * @param userSub - User sub
   * @returns Array of OAuth account entities
   */
  async findByUser(userSub: string): Promise<IUserOAuthEntity[]> {
    return this.find({ user: ref(UserEntity, userSub) });
  }

  /**
   * Link an OAuth account to a user
   *
   * @param params - OAuth account data
   * @returns Newly created OAuth account entity
   */
  async linkAccount(params: {
    userSub: string;
    providerName: string;
    providerUserId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date | null;
  }): Promise<IUserOAuthEntity> {
    const oauthAccount = this.create({
      user: params.userSub,
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
    oauthAccount: IUserOAuthEntity,
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
   * @param userSub - User sub
   * @param providerName - Name of the OAuth provider to unlink
   * @returns True if account was unlinked, false if not found
   */
  async unlinkAccount(userSub: string, providerName: string): Promise<boolean> {
    const oauthAccount = await this.findByUserAndProvider(
      userSub,
      providerName,
    );
    if (!oauthAccount) {
      return false;
    }

    await this.nativeDelete({ id: oauthAccount.id });
    return true;
  }

  /**
   * Count the number of OAuth accounts linked to a user
   *
   * @param userSub - User sub
   * @returns Number of linked OAuth accounts
   */
  async countByUser(userSub: string): Promise<number> {
    return this.count({ user: ref(UserEntity, userSub) });
  }
}

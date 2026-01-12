import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { hash } from 'argon2';
import { OAuthClientEntity } from '@/entities/oauth-client.entity.js';
import { UserEntity } from '@/entities/user.entity.js';
import { AppConfigs } from '@/lib/config.js';

/**
 * ConfigSeeder
 *
 * Synchronizes users and OAuth clients from config.yaml to the database.
 * This seeder is run on every server startup to ensure config data is in DB.
 *
 * Key behaviors:
 * - Uses insert/nativeUpdate to bypass entity lifecycle hooks
 *   (prevents double-hashing of passwords)
 * - Sets managed_by='config' to distinguish from runtime-created records
 * - Cleans up records that were removed from config
 */
export class ConfigSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await this.syncUsers(em);
    await this.syncOAuthClients(em);
  }

  /**
   * Sync users from config.yaml to database
   * Uses nativeInsert/nativeUpdate to bypass @BeforeCreate/@BeforeUpdate hooks
   * which would double-hash the already-hashed password
   */
  private async syncUsers(em: EntityManager): Promise<void> {
    const now = new Date();

    for (const configUser of AppConfigs.users) {
      const hashedPassword = await hash(configUser.password);
      const existingUser = await em.findOne(UserEntity, { id: configUser.id });

      if (existingUser) {
        // Update existing user using nativeUpdate to bypass hooks
        await em.nativeUpdate(
          UserEntity,
          { id: configUser.id },
          {
            email: configUser.email,
            password_hash: hashedPassword,
            email_verified: true,
            managed_by: 'config',
            role: configUser.role ?? 'user',
            totp_secret: configUser.totp_secret ?? null,
            totp_backup_codes: configUser.totp_backup_codes ?? null,
            updated_at: now,
          },
        );
      } else {
        // Create new user using nativeInsert to bypass hooks
        await em.insert(UserEntity, {
          id: configUser.id,
          email: configUser.email,
          password_hash: hashedPassword,
          email_verified: true,
          managed_by: 'config',
          role: configUser.role ?? 'user',
          totp_secret: configUser.totp_secret ?? null,
          totp_backup_codes: configUser.totp_backup_codes ?? null,
          created_at: now,
          updated_at: now,
        });
      }
    }

    // Remove config-managed users that are no longer in config
    const configUserIds = AppConfigs.users.map((u) => u.id);
    if (configUserIds.length > 0) {
      await em.nativeDelete(UserEntity, {
        managed_by: 'config',
        id: { $nin: configUserIds },
      });
    } else {
      // If no config users, remove all config-managed users
      await em.nativeDelete(UserEntity, { managed_by: 'config' });
    }
  }

  /**
   * Sync OAuth clients from config.yaml to database
   * Uses nativeInsert/nativeUpdate to bypass lifecycle hooks
   */
  private async syncOAuthClients(em: EntityManager): Promise<void> {
    const now = new Date();

    for (const provider of AppConfigs.providers) {
      const hashedSecret = await hash(provider.client_secret);
      const existingClient = await em.findOne(OAuthClientEntity, {
        id: provider.id,
      });

      if (existingClient) {
        // Update existing client
        await em.nativeUpdate(
          OAuthClientEntity,
          { id: provider.id },
          {
            clientId: provider.client_id,
            clientSecretHash: hashedSecret,
            name: provider.name,
            logoUri: provider.logo_uri ?? null,
            redirectUris: provider.redirect_uris,
            responseTypes: provider.response_types,
            grantTypes: provider.grant_types,
            scopes: provider.scope.split(' '),
            enabled: true,
            managed_by: 'config',
            updated_at: now,
          },
        );
      } else {
        // Create new client
        await em.insert(OAuthClientEntity, {
          id: provider.id,
          clientId: provider.client_id,
          clientSecretHash: hashedSecret,
          name: provider.name,
          logoUri: provider.logo_uri ?? null,
          redirectUris: provider.redirect_uris,
          responseTypes: provider.response_types,
          grantTypes: provider.grant_types,
          scopes: provider.scope.split(' '),
          enabled: true,
          managed_by: 'config',
          created_at: now,
          updated_at: now,
        });
      }
    }

    // Remove config-managed clients that are no longer in config
    const configClientIds = AppConfigs.providers.map((p) => p.id);
    if (configClientIds.length > 0) {
      await em.nativeDelete(OAuthClientEntity, {
        managed_by: 'config',
        id: { $nin: configClientIds },
      });
    } else {
      // If no config providers, remove all config-managed clients
      await em.nativeDelete(OAuthClientEntity, { managed_by: 'config' });
    }
  }
}

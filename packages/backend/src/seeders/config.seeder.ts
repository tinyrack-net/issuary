import type { EntityManager } from '@mikro-orm/core';
import { hash } from 'argon2';
import { OAuthClientEntity } from '@/entities/oauth-client.entity.js';
import { UserEntity } from '@/entities/user.entity.js';
import type { InternalAppConfig } from '@/lib/config/index.js';

/**
 * ConfigSeeder
 *
 * Synchronizes users and OAuth clients from config.yaml to the database.
 * This seeder is run on every server startup to ensure config data is in DB.
 *
 * Key behaviors:
 * - Uses em.upsert() for atomic INSERT ON CONFLICT operations
 *   (cluster-safe: multiple instances can run concurrently without race conditions)
 * - Bypasses entity lifecycle hooks to prevent double-hashing of passwords
 * - Sets managed_by='config' to distinguish from runtime-created records
 * - Cleans up records that were removed from config
 */

/**
 * Run config seeder with the given config
 */
export async function seedConfig(
  em: EntityManager,
  config: InternalAppConfig,
): Promise<void> {
  await syncUsers(em, config);
  await syncOAuthClients(em, config);
}

/**
 * Sync users from config.yaml to database
 * Uses em.upsert() for atomic upsert operations that are cluster-safe
 */
async function syncUsers(
  em: EntityManager,
  config: InternalAppConfig,
): Promise<void> {
  const now = new Date();

  for (const configUser of config.users) {
    const hashedPassword = await hash(configUser.password);

    // Use upsert for atomic INSERT ON CONFLICT DO UPDATE
    // This is cluster-safe: concurrent instances won't cause race conditions
    await em.upsert(
      UserEntity,
      {
        id: configUser.id,
        email: configUser.email,
        password_hash: hashedPassword,
        email_verified: true,
        managed_by: 'config',
        role: configUser.role ?? 'user',
        created_at: now,
        updated_at: now,
      },
      {
        onConflictFields: ['id'],
        onConflictAction: 'merge',
        // Exclude id and created_at from merge (don't update primary key or creation time)
        onConflictExcludeFields: ['id', 'created_at'],
      },
    );
  }

  // Remove config-managed users that are no longer in config
  const configUserIds = config.users.map((u) => u.id);
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
 * Uses em.upsert() for atomic upsert operations that are cluster-safe
 */
async function syncOAuthClients(
  em: EntityManager,
  config: InternalAppConfig,
): Promise<void> {
  const now = new Date();

  for (const provider of config.providers) {
    // Public clients (PKCE-only) don't have client_secret
    const hashedSecret = provider.client_secret
      ? await hash(provider.client_secret)
      : null;

    // Use upsert for atomic INSERT ON CONFLICT DO UPDATE
    // This is cluster-safe: concurrent instances won't cause race conditions
    await em.upsert(
      OAuthClientEntity,
      {
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
      },
      {
        onConflictFields: ['id'],
        onConflictAction: 'merge',
        // Exclude id and created_at from merge (don't update primary key or creation time)
        onConflictExcludeFields: ['id', 'created_at'],
      },
    );
  }

  // Remove config-managed clients that are no longer in config
  const configClientIds = config.providers.map((p) => p.id);
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

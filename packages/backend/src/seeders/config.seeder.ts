import type { EntityManager } from '@mikro-orm/core';
import { OAuthClientEntitySchema } from '../entities/oauth-client.entity.ts';
import { TermsEntitySchema } from '../entities/terms.entity.ts';
import { TermsContentEntitySchema } from '../entities/terms-content.entity.ts';
import { UserEntity } from '../entities/user.entity.ts';
import type { TinyAuthRuntimeConfig } from '../lib/config/index.ts';
import type { SecurityService } from '../services/security.service.ts';

/**
 * ConfigSeeder
 *
 * Synchronizes users, OAuth clients, and terms from config.yaml to the database.
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
  config: TinyAuthRuntimeConfig,
  securityService: SecurityService,
): Promise<void> {
  await syncTerms(em, config);
  await syncUsers(em, config, securityService);
  await syncOAuthClients(em, config, securityService);
}

/**
 * Sync terms from config.yaml to database
 * Uses em.upsert() for atomic upsert operations that are cluster-safe
 */
async function syncTerms(
  em: EntityManager,
  config: TinyAuthRuntimeConfig,
): Promise<void> {
  const now = new Date();
  const configTerms = config.terms;

  for (const term of configTerms) {
    // Upsert term entity
    await em.upsert(
      TermsEntitySchema,
      {
        id: term.id,
        required: term.required,
        consentMode: term.consent_mode,
        version: term.version,
        managed_by: 'config',
        created_at: now,
        updated_at: now,
      },
      {
        onConflictFields: ['id'],
        onConflictAction: 'merge',
        onConflictExcludeFields: ['id', 'created_at'],
      },
    );

    // Delete existing content for this term (to handle language changes)
    await em.nativeDelete(TermsContentEntitySchema, {
      terms: term.id,
    });

    // Insert new content for each language
    for (const lang of Object.keys(term.content)) {
      const content = term.content[lang];
      if (!content) {
        continue;
      }
      const contentEntity = em.create(TermsContentEntitySchema, {
        terms: term.id,
        lang,
        title: content.title,
        type: content.type,
        content: content.content,
      });
      em.persist(contentEntity);
    }
  }

  await em.flush();

  // Remove config-managed terms that are no longer in config
  const configTermIds = configTerms.map((term) => term.id);
  if (configTermIds.length > 0) {
    await em.nativeDelete(TermsEntitySchema, {
      managed_by: 'config',
      id: { $nin: configTermIds },
    });
  } else {
    // If no config terms, remove all config-managed terms
    await em.nativeDelete(TermsEntitySchema, { managed_by: 'config' });
  }
}

/**
 * Sync users from config.yaml to database
 * Uses em.upsert() for atomic upsert operations that are cluster-safe
 */
async function syncUsers(
  em: EntityManager,
  config: TinyAuthRuntimeConfig,
  securityService: SecurityService,
): Promise<void> {
  const now = new Date();

  for (const configUser of config.users) {
    const hashedPassword = await securityService.hashPassword(
      configUser.password,
    );

    // Use upsert for atomic INSERT ON CONFLICT DO UPDATE
    // This is cluster-safe: concurrent instances won't cause race conditions
    await em.upsert(
      UserEntity,
      {
        sub: configUser.sub,
        email: configUser.email,
        password_hash: hashedPassword,
        email_verified: true,
        managed_by: 'config',
        role: configUser.role ?? 'user',
        created_at: now,
        updated_at: now,
      },
      {
        onConflictFields: ['sub'],
        onConflictAction: 'merge',
        // Exclude sub and created_at from merge (don't update primary key or creation time)
        onConflictExcludeFields: ['sub', 'created_at'],
      },
    );
  }

  // Remove config-managed users that are no longer in config
  const configUserSubs = config.users.map((user) => user.sub);
  if (configUserSubs.length > 0) {
    await em.nativeDelete(UserEntity, {
      managed_by: 'config',
      sub: { $nin: configUserSubs },
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
  config: TinyAuthRuntimeConfig,
  securityService: SecurityService,
): Promise<void> {
  const now = new Date();

  for (const client of config.clients) {
    // Public clients (PKCE-only) don't have client_secret
    const hashedSecret = client.client_secret
      ? await securityService.hashClientSecret(client.client_secret)
      : null;

    // Use upsert for atomic INSERT ON CONFLICT DO UPDATE
    // This is cluster-safe: concurrent instances won't cause race conditions
    await em.upsert(
      OAuthClientEntitySchema,
      {
        id: client.id,
        clientId: client.client_id,
        clientSecretHash: hashedSecret,
        name: client.name,
        logoUri: client.logo_uri ?? null,
        redirectUris: client.redirect_uris,
        responseTypes: client.response_types,
        grantTypes: client.grant_types,
        scopes: client.scope.split(' '),
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
  const configClientIds = config.clients.map((client) => client.id);
  if (configClientIds.length > 0) {
    await em.nativeDelete(OAuthClientEntitySchema, {
      managed_by: 'config',
      id: { $nin: configClientIds },
    });
  } else {
    // If no config providers, remove all config-managed clients
    await em.nativeDelete(OAuthClientEntitySchema, { managed_by: 'config' });
  }
}

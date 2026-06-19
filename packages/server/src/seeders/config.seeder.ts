import type { EntityManager } from '@mikro-orm/core';
import { BootstrapStateEntitySchema } from '../entities/bootstrap-state.entity.ts';
import { OAuthClientEntitySchema } from '../entities/oauth-client.entity.ts';
import { TermsEntitySchema } from '../entities/terms.entity.ts';
import { TermsContentEntitySchema } from '../entities/terms-content.entity.ts';
import { UserEntity } from '../entities/user.entity.ts';
import {
  fromBase64Url,
  stringToBytes,
  toArrayBuffer,
  toBase64Url,
} from '../lib/base64url.ts';
import type { TinyAuthRuntimeConfig } from '../lib/config/index.ts';
import type { SecurityService } from '../services/security.service.ts';

const CONFIG_SEED_STATE_ID = 'config-seed';
const CONFIG_SEED_FINGERPRINT_VERSION = 1;

export type ConfigSeedMode = 'if-changed' | 'always' | 'skip';

function canonicalJson(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter((entry) => entry[1] !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    return `{${entries
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${canonicalJson(entryValue)}`,
      )
      .join(',')}}`;
  }

  return 'null';
}

async function createConfigSeedFingerprint(
  config: TinyAuthRuntimeConfig,
): Promise<string> {
  const payload = canonicalJson({
    version: CONFIG_SEED_FINGERPRINT_VERSION,
    pbkdf2_iterations: config.security.pbkdf2_iterations,
    terms: config.terms,
    users: config.users,
    clients: config.clients,
  });
  const keyBytes = fromBase64Url(config.security.hash_secret);
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(keyBytes),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    toArrayBuffer(stringToBytes(payload)),
  );

  return `v${CONFIG_SEED_FINGERPRINT_VERSION}:${toBase64Url(
    new Uint8Array(signature),
  )}`;
}

function isMissingBootstrapStateTableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const normalized = message.toLowerCase();

  return (
    normalized.includes('bootstrap_state') &&
    (normalized.includes('no such table') ||
      normalized.includes('does not exist') ||
      normalized.includes('not found'))
  );
}

export async function seedConfigIfNeeded(
  em: EntityManager,
  config: TinyAuthRuntimeConfig,
  securityService: SecurityService,
  mode: ConfigSeedMode = 'if-changed',
): Promise<boolean> {
  if (mode === 'skip') {
    return false;
  }

  if (mode === 'always') {
    await seedConfig(em, config, securityService);
    return true;
  }

  const fingerprint = await createConfigSeedFingerprint(config);

  try {
    const state = await em.findOne(BootstrapStateEntitySchema, {
      id: CONFIG_SEED_STATE_ID,
    });
    if (state?.value === fingerprint) {
      return false;
    }
  } catch (err) {
    if (!isMissingBootstrapStateTableError(err)) {
      throw err;
    }

    await seedConfig(em, config, securityService);
    return true;
  }

  await seedConfig(em, config, securityService);
  await em.upsert(
    BootstrapStateEntitySchema,
    {
      id: CONFIG_SEED_STATE_ID,
      value: fingerprint,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      onConflictFields: ['id'],
      onConflictAction: 'merge',
      onConflictExcludeFields: ['id', 'created_at'],
    },
  );

  return true;
}

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
        postLogoutRedirectUris: client.post_logout_redirect_uris,
        webOrigins: client.web_origins,
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

import { type EntityManager, raw } from '@mikro-orm/core';
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
import type { IssuaryRuntimeConfig } from '../lib/config/index.ts';
import { invalidateUserAuthentication } from '../services/authentication-epoch.js';
import type { SecurityService } from '../services/security.service.ts';

const CONFIG_SEED_STATE_ID = 'config-seed';
const CONFIG_SEED_FINGERPRINT_VERSION = 4;

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
  config: IssuaryRuntimeConfig,
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

async function lockBootstrap(em: EntityManager): Promise<void> {
  const now = new Date();
  await em.upsert(
    BootstrapStateEntitySchema,
    {
      id: 'config-seed-lock',
      value: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    },
    { onConflictFields: ['id'], onConflictExcludeFields: ['created_at'] },
  );
}

export async function seedConfigIfNeeded(
  em: EntityManager,
  config: IssuaryRuntimeConfig,
  securityService: SecurityService,
  mode: ConfigSeedMode = 'if-changed',
): Promise<boolean> {
  if (mode === 'skip') return false;
  return em.transactional(async (transaction) => {
    await lockBootstrap(transaction);
    return seedConfigIfNeededLocked(transaction, config, securityService, mode);
  });
}

async function seedConfigIfNeededLocked(
  em: EntityManager,
  config: IssuaryRuntimeConfig,
  securityService: SecurityService,
  mode: ConfigSeedMode = 'if-changed',
): Promise<boolean> {
  if (mode === 'skip') {
    return false;
  }

  const fingerprint = await createConfigSeedFingerprint(config);

  try {
    const state = await em.findOne(BootstrapStateEntitySchema, {
      id: CONFIG_SEED_STATE_ID,
    });
    if (mode !== 'always' && state?.value === fingerprint) {
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
  config: IssuaryRuntimeConfig,
  securityService: SecurityService,
): Promise<void> {
  await em.transactional(async (transaction) => {
    await lockBootstrap(transaction);
    await syncTerms(transaction, config);
    await syncUsers(transaction, config, securityService);
    await syncOAuthClients(transaction, config, securityService);
  });
}

/**
 * Sync terms from config.yaml to database
 * Uses em.upsert() for atomic upsert operations that are cluster-safe
 */
async function syncTerms(
  em: EntityManager,
  config: IssuaryRuntimeConfig,
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
  config: IssuaryRuntimeConfig,
  securityService: SecurityService,
): Promise<void> {
  const now = new Date();
  for (const configUser of [...config.users].sort((a, b) =>
    a.sub.localeCompare(b.sub),
  )) {
    await em.nativeUpdate(
      UserEntity,
      { sub: configUser.sub },
      { security_revision: raw<number>('security_revision + 1') },
    );
    // The bootstrap write lock is held before this read.
    const user = await em.findOne(
      UserEntity,
      { sub: configUser.sub },
      { populate: ['password_hash'], refresh: true },
    );
    if (user && user.managed_by !== 'config')
      throw new Error('Config subject conflicts with a database-managed user');
    const samePassword = user?.password_hash
      ? await securityService.verifyPassword(
          user.password_hash,
          configUser.password,
        )
      : false;
    const changed =
      !user ||
      !samePassword ||
      user.email !== configUser.email ||
      user.role !== (configUser.role ?? 'user') ||
      user.deleted_at !== null;
    if (user && changed) await invalidateUserAuthentication(em, user);
    const data = {
      sub: configUser.sub,
      email: configUser.email,
      password_hash: samePassword
        ? user?.password_hash
        : await securityService.hashPassword(configUser.password),
      email_verified: true,
      managed_by: 'config',
      role: configUser.role ?? 'user',
      deleted_at: null,
      ...(changed
        ? {
            sessions_invalidated_at: now,
            token_epoch: user?.token_epoch ?? crypto.randomUUID(),
          }
        : {}),
    } satisfies Partial<UserEntity>;
    if (user) {
      await em.nativeUpdate(
        UserEntity,
        { sub: user.sub },
        {
          ...data,
          security_revision: raw<number>('security_revision + 1'),
          updated_at: now,
        },
      );
    } else {
      await em.insert(UserEntity, {
        ...data,
        created_at: now,
        updated_at: now,
      });
    }
  }
  const subjects = config.users.map((user) => user.sub);
  const removed = await em.find(UserEntity, {
    managed_by: 'config',
    deleted_at: null,
    ...(subjects.length ? { sub: { $nin: subjects } } : {}),
  });
  for (const candidate of removed.sort((a, b) => a.sub.localeCompare(b.sub))) {
    await em.nativeUpdate(
      UserEntity,
      { sub: candidate.sub },
      { security_revision: raw<number>('security_revision + 1') },
    );
    const user = await em.findOneOrFail(
      UserEntity,
      { sub: candidate.sub },
      { refresh: true },
    );
    await invalidateUserAuthentication(em, user);
    await em.nativeUpdate(
      UserEntity,
      { sub: user.sub },
      {
        deleted_at: now,
        sessions_invalidated_at: now,
        token_epoch: user.token_epoch,
        security_revision: raw<number>('security_revision + 1'),
      },
    );
  }
}

/**
 * Sync OAuth clients from config.yaml to database
 * Uses em.upsert() for atomic upsert operations that are cluster-safe
 */
async function syncOAuthClients(
  em: EntityManager,
  config: IssuaryRuntimeConfig,
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
        deletedAt: null,
        tokenEpoch: crypto.randomUUID(),
        skipConsent: client.skip_consent,
        managed_by: 'config',
        created_at: now,
        updated_at: now,
      },
      {
        onConflictFields: ['id'],
        onConflictAction: 'merge',
        // Exclude id and created_at from merge (don't update primary key or creation time)
        onConflictExcludeFields: ['id', 'created_at', 'tokenEpoch'],
      },
    );
  }

  // Soft-delete config-managed clients that are no longer in config. Keeping
  // the row preserves dependent grants and consents until retention cleanup.
  const configClientIds = config.clients.map((client) => client.id);
  const removedClients = await em.find(OAuthClientEntitySchema, {
    managed_by: 'config',
    deletedAt: null,
    ...(configClientIds.length > 0 && { id: { $nin: configClientIds } }),
  });
  for (const client of removedClients) {
    client.deletedAt = now;
    client.tokenEpoch = crypto.randomUUID();
  }
  await em.flush();
}

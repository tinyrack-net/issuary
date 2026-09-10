import { type EntityManager, LockMode, raw } from '@mikro-orm/core';
import { PostgreSqlPlatform } from '@mikro-orm/postgresql';
import { BootstrapStateEntitySchema } from '../entities/bootstrap-state.entity.js';

const TERMS_POLICY_LOCK = 'terms-policy-lock';
export type TermsPolicyAccess = 'read' | 'write';

/** Initialize before serving requests, even when config seeding is disabled. */
export async function initializeTermsPolicy(em: EntityManager): Promise<void> {
  await em.upsert(
    BootstrapStateEntitySchema,
    { id: TERMS_POLICY_LOCK, value: '1' },
    { onConflictFields: ['id'], onConflictAction: 'ignore' },
  );
}

/** Acquire before user/session/client locks; the transaction owns its lifetime. */
export async function lockTermsPolicy(
  em: EntityManager,
  access: TermsPolicyAccess,
): Promise<void> {
  if (!em.isInTransaction())
    throw new Error('Terms policy requires a transaction');
  if (em.getPlatform() instanceof PostgreSqlPlatform) {
    await em.findOneOrFail(
      BootstrapStateEntitySchema,
      { id: TERMS_POLICY_LOCK },
      {
        refresh: true,
        lockMode:
          access === 'read'
            ? LockMode.PESSIMISTIC_READ
            : LockMode.PESSIMISTIC_WRITE,
      },
    );
    return;
  }
  const changed = await em.nativeUpdate(
    BootstrapStateEntitySchema,
    { id: TERMS_POLICY_LOCK },
    { value: raw<string>('value') },
  );
  if (changed !== 1) throw new Error('Terms policy lock is not initialized');
}

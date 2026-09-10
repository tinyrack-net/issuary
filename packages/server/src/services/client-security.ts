import { type EntityManager, raw } from '@mikro-orm/core';
import { OAuthClientEntitySchema } from '../entities/oauth-client.entity.js';

/** Caller owns the transaction. Lifecycle changes and flow consumption use this lock. */
export async function lockOAuthClient(em: EntityManager, id: string) {
  const changed = await em.nativeUpdate(
    OAuthClientEntitySchema,
    { id },
    { updated_at: raw<Date>('updated_at') },
  );
  if (changed !== 1) return null;
  return em.findOne(OAuthClientEntitySchema, { id }, { refresh: true });
}

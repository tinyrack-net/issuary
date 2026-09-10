import { raw, UniqueConstraintViolationException } from '@mikro-orm/core';
import { AuthBudgetEntitySchema } from '../entities/auth-budget.entity.js';
import type { MikroService } from './mikro.service.js';
import type { SecurityService } from './security.service.js';

/** Shared, atomic fixed-window budgets. No process-local locks or raw PII keys. */
export async function consumeAuthBudget(
  mikro: MikroService,
  security: SecurityService,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<number | null> {
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const expires = (bucket + 1) * windowMs;
  const id = await security.hashOpaqueToken('auth-budget', `${key}:${bucket}`);
  try {
    await mikro.em.insert(AuthBudgetEntitySchema, {
      id,
      attempts: 1,
      expires_at: new Date(expires),
    });
    return null;
  } catch (error) {
    if (!(error instanceof UniqueConstraintViolationException)) throw error;
  }
  const changed = await mikro.em.nativeUpdate(
    AuthBudgetEntitySchema,
    { id, attempts: { $lt: limit } },
    { attempts: raw<number>('attempts + 1') },
  );
  return changed === 1 ? null : Math.max(1, Math.ceil((expires - now) / 1000));
}

export async function clearAuthBudget(
  mikro: MikroService,
  security: SecurityService,
  key: string,
  windowSeconds: number,
  requestedAt: number,
): Promise<void> {
  const bucket = Math.floor(requestedAt / (windowSeconds * 1000));
  const id = await security.hashOpaqueToken('auth-budget', `${key}:${bucket}`);
  await mikro.em.nativeDelete(AuthBudgetEntitySchema, { id });
}

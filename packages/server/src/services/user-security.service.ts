import { raw } from '@mikro-orm/core';
import { UserEntity } from '../entities/user.entity.js';
import type { IssuaryRuntimeConfig } from '../lib/config/index.js';
import { e } from '../schemas/error.js';
import type { MikroService } from './mikro.service.js';

export function isSecurityConflict(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code: unknown = Reflect.get(error, 'code');
  return (
    [
      'SQLITE_BUSY',
      'SQLITE_BUSY_SNAPSHOT',
      'SQLITE_LOCKED',
      '40001',
      '40P01',
      '55P03',
    ].includes(String(code)) ||
    /database (?:is )?locked|serialization failure|deadlock detected/i.test(
      error.message,
    )
  );
}

/** The write precedes every policy read, including on SQLite's deferred transactions. */
export async function withUserSecurity<T>(
  mikro: MikroService,
  sub: string,
  operation: (user: UserEntity) => Promise<T>,
  options: { includeDeleted?: boolean } = {},
): Promise<T> {
  try {
    return await mikro.em.transactional(async (em) => {
      const changed = await em.nativeUpdate(
        UserEntity,
        { sub, ...(options.includeDeleted ? {} : { deleted_at: null }) },
        { security_revision: raw<number>('security_revision + 1') },
      );
      if (changed !== 1) throw new e.UserNotFound.Error();
      const user = await em.findOneOrFail(
        UserEntity,
        { sub },
        { populate: ['password_hash'], refresh: true },
      );
      return operation(user);
    });
  } catch (error) {
    if (isSecurityConflict(error)) throw new e.ConcurrentSecurityChange.Error();
    throw error;
  }
}

export async function authenticationMethods(
  mikro: MikroService,
  config: IssuaryRuntimeConfig,
  user: UserEntity,
) {
  const providers = config.identity_providers
    .filter((provider) => provider.enabled)
    .map((provider) => provider.id);
  const oauth = providers.length
    ? await mikro.userOAuth.count({
        user: user.sub,
        provider_name: { $in: providers },
      })
    : 0;
  const passkeys = config.auth.passkey.enabled
    ? await mikro.userPasskey.countByUserSub(user.sub)
    : 0;
  const totp =
    config.auth.password.totp.enabled &&
    (await mikro.userTotp.isRegistered(user.sub));
  return {
    oauth,
    passkeys,
    totp,
    password: config.auth.password.enabled && user.hasPassword(),
  };
}

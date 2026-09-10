import { raw } from '@mikro-orm/core';
import { BrowserSessionEntitySchema } from '../entities/browser-session.entity.js';
import { UserEntity } from '../entities/user.entity.js';
import type { AppEnv } from '../lib/app-env.js';
import { e } from '../schemas/error.js';
import {
  lockTermsPolicy,
  type TermsPolicyAccess,
} from './terms-policy.service.js';
import { isSecurityConflict } from './user-security.service.js';

/** Credential preparation must finish before entering this transaction. */
export async function withBrowserSecurity<T>(
  c: { var: AppEnv['Variables']; req: { path: string } },
  operation: () => Promise<T>,
  options: {
    stage?: 'setup' | 'mfa';
    targets?: string[];
    termsPolicy?: TermsPolicyAccess;
  } = {},
): Promise<T> {
  const { session, services } = c.var;
  const original = session.authorization;
  const subject =
    options.stage === 'setup'
      ? (original.pending2FASetup ?? original.user)
      : options.stage === 'mfa'
        ? original.pending2FAUser
        : original.user;
  if (!subject) throw new e.Unauthorized.Error();
  const epoch = original.security?.grants[subject.sub];
  if (!epoch) throw new e.Unauthorized.Error();
  try {
    return await session.atomic(async () => {
      const em = services.mikro.em;
      if (options.termsPolicy) await lockTermsPolicy(em, options.termsPolicy);
      for (const sub of [
        ...new Set([subject.sub, ...(options.targets ?? [])]),
      ].sort()) {
        const changed = await em.nativeUpdate(
          UserEntity,
          { sub },
          { security_revision: raw<number>('security_revision + 1') },
        );
        if (changed !== 1) {
          if (sub !== subject.sub) throw new e.UserNotFound.Error();
          throw new e.Unauthorized.Error();
        }
      }
      const user = await em.findOneOrFail(
        UserEntity,
        { sub: subject.sub },
        { refresh: true },
      );
      if (user.deleted_at || user.token_epoch !== epoch)
        throw new e.Unauthorized.Error();
      if (c.req.path.startsWith('/api/admin/') && user.role !== 'admin')
        throw new e.Forbidden.Error();
      const locked = await em.nativeUpdate(
        BrowserSessionEntitySchema,
        {
          id: session.id,
          revision: session.revision,
          expires_at: { $gt: new Date() },
        },
        { revision: session.revision },
      );
      if (locked !== 1) throw new e.Unauthorized.Error();
      const current = await em.findOneOrFail(
        BrowserSessionEntitySchema,
        { id: session.id },
        { refresh: true },
      );
      if (current.data.security?.grants[subject.sub] !== epoch)
        throw new e.Unauthorized.Error();
      if (
        options.stage &&
        subject !== original.user &&
        (current.data.security?.pendingExpiresAt ?? 0) <= Date.now()
      )
        throw new e.Unauthorized.Error();
      const security = current.data.security;
      if (original.oauth && (security?.oauthExpiresAt ?? 0) <= Date.now())
        throw new e.Unauthorized.Error();
      if (
        original.passkey_challenge &&
        (security?.challengeExpiresAt ?? 0) <= Date.now()
      )
        throw new e.Unauthorized.Error();
      // Password-only enrollment authority ends once any factor is enrolled,
      // including when another browser finishes while this request is waiting.
      if (
        options.stage === 'setup' &&
        original.pending2FASetup &&
        (await services.userService.userRegistered2FAMethods(subject.sub))
          .length > 0
      )
        throw new e.Unauthorized.Error();
      const result = await operation();
      const after = await em.findOneOrFail(
        UserEntity,
        { sub: subject.sub },
        { refresh: true },
      );
      if (after.deleted_at || after.token_epoch !== epoch) {
        session.clearAuthSessions();
        session.set(
          'accounts',
          session
            .get('accounts')
            ?.filter((account) => account.sub !== subject.sub),
        );
      }
      return result;
    });
  } catch (error) {
    if (isSecurityConflict(error)) throw new e.ConcurrentSecurityChange.Error();
    throw error;
  }
}

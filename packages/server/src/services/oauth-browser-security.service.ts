import { raw, UniqueConstraintViolationException } from '@mikro-orm/core';
import { BrowserSessionEntitySchema } from '../entities/browser-session.entity.js';
import { UserEntity } from '../entities/user.entity.js';
import type { AppEnv } from '../lib/app-env.js';
import { e } from '../schemas/error.js';
import type {
  OAuthAuthenticationProof,
  OAuthCallbackResult,
} from './oauth-connect.service.js';
import { lockTermsPolicy } from './terms-policy.service.js';
import { isSecurityConflict } from './user-security.service.js';

/** External proof preparation happens before acquiring either database lock. */
export async function completeOAuthAuthentication(
  c: { var: AppEnv['Variables'] },
  proof: OAuthAuthenticationProof,
  operation: () => Promise<OAuthCallbackResult>,
): Promise<OAuthCallbackResult> {
  const { session, services } = c.var;
  const original = session.authorization.oauth;
  if (!original || original.mode === 'link')
    throw new e.OAuthSessionExpired.Error();
  try {
    return await session.atomic(async () => {
      const em = services.mikro.em;
      await lockTermsPolicy(em, 'read');
      if (proof.kind !== 'registration') {
        const changed = await em.nativeUpdate(
          UserEntity,
          { sub: proof.userSub },
          {
            security_revision: raw<number>('security_revision + 1'),
          },
        );
        if (changed !== 1) throw new e.OAuthSessionExpired.Error();
        const user = await em.findOneOrFail(
          UserEntity,
          { sub: proof.userSub },
          { refresh: true },
        );
        if (user.deleted_at || user.token_epoch !== proof.userEpoch)
          throw new e.OAuthSessionExpired.Error();
      }
      // A newly created user is written before the browser session is locked.
      const preparedResult =
        proof.kind === 'registration' ? await operation() : undefined;
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
      const record = await em.findOneOrFail(
        BrowserSessionEntitySchema,
        { id: session.id },
        { refresh: true },
      );
      const current = record.data.oauth;
      if (
        !current ||
        current.state !== original.state ||
        current.providerId !== proof.providerId ||
        current.providerId !== original.providerId ||
        current.mode !== original.mode ||
        current.codeVerifier !== original.codeVerifier ||
        (record.data.security?.oauthExpiresAt ?? 0) <= Date.now()
      )
        throw new e.OAuthSessionExpired.Error();
      const result = preparedResult ?? (await operation());
      session.set('oauth', undefined);
      if (
        result.action === 'login_complete' ||
        result.action === 'login_terms_redirect'
      ) {
        if (
          proof.kind !== 'registration' &&
          (result.userSub !== proof.userSub ||
            result.userEpoch !== proof.userEpoch)
        )
          throw new e.OAuthSessionExpired.Error();
        session.setUserSession(result.userSub, result.userEpoch);
      }
      return result;
    });
  } catch (error) {
    if (error instanceof UniqueConstraintViolationException)
      throw new e.OAuthSessionExpired.Error();
    if (isSecurityConflict(error)) throw new e.ConcurrentSecurityChange.Error();
    throw error;
  }
}

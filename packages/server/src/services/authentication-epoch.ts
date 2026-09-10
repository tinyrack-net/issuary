import type { EntityManager } from '@mikro-orm/core';
import { EmailVerificationEntitySchema } from '../entities/email-verification.entity.js';
import { PasswordResetEntitySchema } from '../entities/password-reset.entity.js';
import { PendingOAuthRegistrationEntitySchema } from '../entities/pending-oauth-registration.entity.js';
import type { UserEntity } from '../entities/user.entity.js';
import { UserOAuthEntitySchema } from '../entities/user-oauth.entity.js';

/** Called while the user's write lock is held. Expiry is secondary to epoch equality. */
export async function invalidateUserAuthentication(
  em: EntityManager,
  user: UserEntity,
): Promise<void> {
  const identities = await em.find(UserOAuthEntitySchema, { user: user.sub });
  await em.nativeDelete(PendingOAuthRegistrationEntitySchema, {
    $or: [
      { userInfo: { email: user.email } },
      ...identities.map((identity) => ({
        providerId: identity.provider_name,
        userInfo: { id: identity.provider_user_id },
      })),
    ],
  });
  user.token_epoch = crypto.randomUUID();
  user.sessions_invalidated_at = new Date();
  await em.nativeUpdate(
    EmailVerificationEntitySchema,
    { user: user.sub, verified: false },
    { expiresAt: new Date(0) },
  );
  await em.nativeUpdate(
    PasswordResetEntitySchema,
    { user: user.sub, used: false },
    { expiresAt: new Date(0) },
  );
}

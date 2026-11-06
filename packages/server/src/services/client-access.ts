import type { IssuaryRuntimeConfig } from '../lib/config/index.ts';

/**
 * The user attributes a client access policy can match on.
 */
export interface ClientAccessSubject {
  sub: string;
  email: string;
  email_verified: boolean;
  role: 'user' | 'admin';
}

/**
 * Whether `user` may obtain authorization from the client `clientId`.
 *
 * Clients without `access` allow every user. Otherwise the user must match a
 * listed `sub`, a listed email (only when the email is verified, compared
 * case-insensitively) or a listed role. The policy is read from the current
 * configuration on every call, so removing a user takes effect for existing
 * grants on their next code exchange or refresh.
 */
export function isClientAccessAllowed(
  config: IssuaryRuntimeConfig,
  clientId: string,
  user: ClientAccessSubject,
): boolean {
  const access = config.clients.find(
    (client) => client.client_id === clientId,
  )?.access;
  if (!access) return true;
  if (access.users.includes(user.sub)) return true;
  if (access.roles.includes(user.role)) return true;
  if (user.email_verified) {
    const email = user.email.toLowerCase();
    if (access.emails.some((allowed) => allowed.toLowerCase() === email)) {
      return true;
    }
  }
  return false;
}

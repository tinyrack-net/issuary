import { encrypt } from '../lib/crypto.js';
import type { SessionData } from '../middleware/session.js';
import { BrowserSessionService } from '../services/browser-session.service.js';
import type { ServiceContainer } from '../services/container.js';
import { withMikroContext } from './helpers.js';

/** Seed authoritative state for expiry, chooser and protocol boundary tests. */
export async function createStoredSessionCookie(
  services: ServiceContainer,
  serialized: string,
  secret: string,
): Promise<string> {
  const data: SessionData = JSON.parse(serialized);
  const subjects = [
    data.user?.sub,
    data.pending2FAUser?.sub,
    data.pending2FASetup?.sub,
    ...(data.accounts ?? []).map((account) => account.sub),
  ];
  const id = crypto.randomUUID();
  await withMikroContext(services, async () => {
    const grants: Record<string, string> = {};
    for (const sub of subjects) {
      if (!sub) continue;
      const user = await services.mikro.user.findOneOrFail({ sub });
      grants[sub] = user.token_epoch;
    }
    data.security = { ...data.security, grants };
    const saved = await new BrowserSessionService(services.mikro.em).save(
      {
        id,
        data,
        revision: 0,
        expires_at: new Date(Date.now() + 86_400_000),
      },
      true,
    );
    if (!saved) throw new Error('Unable to seed session');
  });
  return encrypt(JSON.stringify({ sid: id, kind: 'session' }), secret);
}

/**
 * Seed a fully authenticated browser session for an existing user.
 *
 * Performance fixtures must not authenticate through the real login route:
 * repeated logins would consume the per-email and per-source authentication
 * budgets that production traffic relies on. Seeding authoritative session
 * state keeps the measured requests realistic without exhausting those budgets.
 */
export async function createAuthenticatedSessionCookie(
  services: ServiceContainer,
  sub: string,
  extra: Omit<SessionData, 'user'> = {},
): Promise<string> {
  const authenticatedAt = Math.floor(Date.now() / 1000);

  return createStoredSessionCookie(
    services,
    JSON.stringify({
      user: { sub, authenticated_at: authenticatedAt },
      ...extra,
    }),
    services.config.security.session_secret,
  );
}

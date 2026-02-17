import { decrypt, encrypt } from '@backend/lib/crypto.js';
import { getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';

export type SessionEnv = { Variables: { session: SessionHelper } };

export interface SessionData {
  /**
   * Fully authenticated user session.
   * Set after successful login (password, OAuth, passkey) and 2FA verification.
   * Cleared when entering pending 2FA states or on logout.
   */
  user?: {
    id: string;
    authenticated_at: number;
  };
  /**
   * Intermediate session for users who have passed primary authentication
   * (e.g., password) but still need to complete 2FA (TOTP) verification.
   * Promoted to `user` session after successful 2FA, or cleared on failure.
   */
  pending2FAUser?: {
    id: string;
    authenticated_at: number;
  };
  /**
   * Intermediate session for users who have registered but need to set up
   * 2FA (TOTP) before their account is fully activated.
   * Promoted to `user` session after successful TOTP setup.
   */
  pending2FASetup?: {
    id: string;
  };
  /**
   * Temporary state for external OAuth provider flows (social login/register/link).
   * Stored when redirecting to the OAuth provider (authorize endpoint) and
   * consumed when the provider redirects back (callback endpoint).
   * Contains CSRF state, PKCE verifier, provider ID, flow mode, and return URL.
   */
  oauth?: {
    state: string;
    codeVerifier: string;
    providerId: string;
    mode: 'login' | 'register' | 'link';
    returnUrl?: string | undefined;
  };
  /**
   * WebAuthn/passkey challenge string for passkey registration and authentication.
   * Set when generating passkey options and validated during passkey verification.
   * Cleared after successful verification.
   */
  passkey_challenge?: string;
}

export interface SessionHelper {
  get<K extends keyof SessionData>(key: K): SessionData[K];
  set<K extends keyof SessionData>(key: K, value: SessionData[K]): void;
  delete(): void;
  setUserSession(userId: string, authenticatedAt?: number): void;
  setPending2FASession(userId: string, authenticatedAt?: number): void;
  setPending2FASetupSession(userId: string): void;
  clearAuthSessions(): void;
}

function createSessionHelper(
  data: SessionData,
  changed: { value: boolean },
): SessionHelper {
  return {
    get<K extends keyof SessionData>(key: K): SessionData[K] {
      return data[key];
    },
    set<K extends keyof SessionData>(key: K, value: SessionData[K]): void {
      data[key] = value;
      changed.value = true;
    },
    delete(): void {
      for (const key of Object.keys(data)) {
        Reflect.deleteProperty(data, key);
      }
      changed.value = true;
    },
    setUserSession(userId: string, authenticatedAt?: number): void {
      delete data.pending2FAUser;
      delete data.pending2FASetup;
      data.user = {
        id: userId,
        authenticated_at: authenticatedAt ?? Math.floor(Date.now() / 1000),
      };
      changed.value = true;
    },
    setPending2FASession(userId: string, authenticatedAt?: number): void {
      delete data.user;
      delete data.pending2FASetup;
      data.pending2FAUser = {
        id: userId,
        authenticated_at: authenticatedAt ?? Math.floor(Date.now() / 1000),
      };
      changed.value = true;
    },
    setPending2FASetupSession(userId: string): void {
      delete data.user;
      delete data.pending2FAUser;
      data.pending2FASetup = { id: userId };
      changed.value = true;
    },
    clearAuthSessions(): void {
      delete data.user;
      delete data.pending2FAUser;
      delete data.pending2FASetup;
      changed.value = true;
    },
  };
}

export function sessionMiddleware(cookieSecret: string, isSecure: boolean) {
  return createMiddleware<SessionEnv>(async (c, next) => {
    const cookieValue = getCookie(c, 'session');

    let sessionData: SessionData = {};
    if (cookieValue) {
      const decrypted = decrypt(cookieValue, cookieSecret);
      if (decrypted) {
        try {
          // Cast is acceptable: we encrypt/decrypt our own
          // SessionData, so the parsed shape is trusted.
          sessionData = JSON.parse(decrypted) as SessionData;
        } catch {
          sessionData = {};
        }
      }
    }

    const changed = { value: false };
    const session = createSessionHelper(sessionData, changed);
    c.set('session', session);

    await next();

    // Only set cookie if session was modified
    if (changed.value) {
      const hasData = Object.values(sessionData).some((v) => v !== undefined);
      if (hasData) {
        const encrypted = encrypt(JSON.stringify(sessionData), cookieSecret);
        setCookie(c, 'session', encrypted, {
          path: '/',
          httpOnly: true,
          secure: isSecure,
          sameSite: 'Lax',
        });
      } else {
        // Clear the cookie if session is empty
        setCookie(c, 'session', '', {
          path: '/',
          httpOnly: true,
          secure: isSecure,
          sameSite: 'Lax',
          maxAge: 0,
        });
      }
    }
  });
}

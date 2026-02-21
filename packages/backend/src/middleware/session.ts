import { decrypt, encrypt } from '@backend/lib/crypto.js';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';

export type SessionEnv = { Variables: { session: SessionHelper } };

export interface SessionData {
  /**
   * Fully authenticated user session.
   * Set after successful login (password, OAuth, passkey) and 2FA verification.
   * Cleared when entering pending 2FA states or on logout.
   */
  user?: {
    sub: string;
    authenticated_at: number;
  };
  /**
   * Intermediate session for users who have passed primary authentication
   * (e.g., password) but still need to complete 2FA (TOTP) verification.
   * Promoted to `user` session after successful 2FA, or cleared on failure.
   */
  pending2FAUser?: {
    sub: string;
    authenticated_at: number;
  };
  /**
   * Intermediate session for users who have registered but need to set up
   * 2FA (TOTP) before their account is fully activated.
   * Promoted to `user` session after successful TOTP setup.
   */
  pending2FASetup?: {
    sub: string;
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
  setUserSession(userSub: string, authenticatedAt?: number): void;
  setPending2FASession(userSub: string, authenticatedAt?: number): void;
  setPending2FASetupSession(userSub: string): void;
  clearAuthSessions(): void;
}

export function sessionMiddleware(cookieSecret: string, isSecure: boolean) {
  return createMiddleware<SessionEnv>(async (c, next) => {
    const cookieValue = getCookie(c, 'session');

    let sessionData: SessionData = {};
    if (cookieValue) {
      const decrypted = await decrypt(cookieValue, cookieSecret);
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

    let changed = false;
    const data: SessionData = new Proxy(sessionData, {
      set(target, prop, value) {
        changed = true;
        return Reflect.set(target, prop, value);
      },
      deleteProperty(target, prop) {
        changed = true;
        return Reflect.deleteProperty(target, prop);
      },
    });

    c.set('session', {
      get<K extends keyof SessionData>(key: K): SessionData[K] {
        return data[key];
      },
      set<K extends keyof SessionData>(key: K, value: SessionData[K]): void {
        data[key] = value;
      },
      delete(): void {
        for (const key of Object.keys(data)) {
          Reflect.deleteProperty(data, key);
        }
      },
      setUserSession(userSub: string, authenticatedAt?: number): void {
        delete data.pending2FAUser;
        delete data.pending2FASetup;
        data.user = {
          sub: userSub,
          authenticated_at: authenticatedAt ?? Math.floor(Date.now() / 1000),
        };
      },
      setPending2FASession(userSub: string, authenticatedAt?: number): void {
        delete data.user;
        delete data.pending2FASetup;
        data.pending2FAUser = {
          sub: userSub,
          authenticated_at: authenticatedAt ?? Math.floor(Date.now() / 1000),
        };
      },
      setPending2FASetupSession(userSub: string): void {
        delete data.user;
        delete data.pending2FAUser;
        data.pending2FASetup = { sub: userSub };
      },
      clearAuthSessions(): void {
        delete data.user;
        delete data.pending2FAUser;
        delete data.pending2FASetup;
      },
    });

    await next();

    if (changed) {
      const hasData = Object.values(sessionData).some((v) => v !== undefined);
      if (hasData) {
        const encrypted = await encrypt(
          JSON.stringify(sessionData),
          cookieSecret,
        );
        setCookie(c, 'session', encrypted, {
          path: '/',
          httpOnly: true,
          secure: isSecure,
          sameSite: 'Lax',
        });
      } else {
        deleteCookie(c, 'session', { path: '/' });
      }
    }
  });
}

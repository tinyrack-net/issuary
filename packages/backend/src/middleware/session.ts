import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '@/lib/app.js';

export interface SessionData {
  user?: {
    id: string;
    authenticated_at: number;
  };
  pending2FAUser?: {
    id: string;
    authenticated_at: number;
  };
  pending2FASetup?: {
    id: string;
  };
  oauth?: {
    state: string;
    codeVerifier: string;
    providerId: string;
    mode: 'login' | 'register' | 'link';
    returnUrl?: string | undefined;
  };
  pendingOAuthRegistration?: {
    providerId: string;
    tokens: {
      access_token: string;
      refresh_token?: string | undefined;
      expires_in?: number | undefined;
      token_type: string;
    };
    userInfo: {
      id: string;
      email: string;
      email_verified: boolean;
      name?: string | undefined;
      picture?: string | undefined;
    };
    returnUrl?: string | undefined;
    expiresAt: number;
  };
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

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function encrypt(data: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Format: base64(iv + authTag + encrypted)
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64url');
}

function decrypt(encoded: string, keyHex: string): string | null {
  try {
    const key = Buffer.from(keyHex, 'hex');
    const combined = Buffer.from(encoded, 'base64url');
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      return null;
    }
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
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
      for (const key of Object.keys(data) as (keyof SessionData)[]) {
        delete data[key];
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
  return createMiddleware<AppEnv>(async (c, next) => {
    const cookieValue = getCookie(c, 'session');

    let sessionData: SessionData = {};
    if (cookieValue) {
      const decrypted = decrypt(cookieValue, cookieSecret);
      if (decrypted) {
        try {
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

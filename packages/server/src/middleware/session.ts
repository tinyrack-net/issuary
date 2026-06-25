import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { decrypt, encrypt } from '../lib/crypto.ts';

export type SessionEnv = { Variables: { session: SessionHelper } };

const DEFAULT_MAX_REMEMBERED_ACCOUNTS = 5;

export interface RememberedAccountsOptions {
  enabled?: boolean | undefined;
  maxAccounts?: number | undefined;
  ttlMs?: number | undefined;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

interface ResolvedRememberedAccountsOptions {
  enabled: boolean;
  maxAccounts: number;
  ttlMs?: number | undefined;
}

function resolveRememberedAccountsOptions(
  options: RememberedAccountsOptions | undefined,
): ResolvedRememberedAccountsOptions {
  return {
    enabled: options?.enabled ?? true,
    maxAccounts: options?.maxAccounts ?? DEFAULT_MAX_REMEMBERED_ACCOUNTS,
    ttlMs: options?.ttlMs,
  };
}

function pruneRememberedAccounts(
  accounts: SessionAccount[],
  options: ReturnType<typeof resolveRememberedAccountsOptions>,
): SessionAccount[] {
  const ttlSeconds =
    options.ttlMs === undefined ? undefined : Math.floor(options.ttlMs / 1000);
  const freshAccounts =
    ttlSeconds === undefined
      ? accounts
      : accounts.filter(
          (account) => nowSeconds() - account.last_used_at <= ttlSeconds,
        );
  return freshAccounts.slice(-options.maxAccounts);
}

export interface SessionAccount {
  sub: string;
  authenticated_at: number;
  last_used_at: number;
}

export interface AccountSelectionSession {
  id: string;
  client_id: string;
  request_fingerprint: string;
  allow_add_account: boolean;
  allowed_subs: string[];
  created_at: number;
}

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
   * Browser-local remembered authenticated accounts for OIDC account selection.
   * This is stored only in the encrypted session cookie and must never be
   * treated as an authoritative user directory.
   */
  accounts?: SessionAccount[];
  /**
   * Server-side continuation marker for account chooser completion.
   * The public query flag is not trusted unless it matches this encrypted
   * browser-session value.
   */
  accountSelection?: AccountSelectionSession;
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
  selectUserSession(userSub: string): boolean;
  removeRememberedUserSession(userSub: string): boolean;
  setPending2FASession(userSub: string, authenticatedAt?: number): void;
  setPending2FASetupSession(userSub: string): void;
  clearAuthSessions(): void;
}

export function sessionMiddleware(
  cookieSecret: string,
  isSecure: boolean,
  rememberedAccountsOptions?: RememberedAccountsOptions,
) {
  const rememberedOptions = resolveRememberedAccountsOptions(
    rememberedAccountsOptions,
  );
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

    if (!rememberedOptions.enabled) {
      if (data.accounts !== undefined) {
        delete data.accounts;
      }
    } else if (data.accounts) {
      const prunedAccounts = pruneRememberedAccounts(
        data.accounts,
        rememberedOptions,
      );
      if (prunedAccounts.length !== data.accounts.length) {
        data.accounts = prunedAccounts;
      }
    }

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
        const authTime = authenticatedAt ?? nowSeconds();
        delete data.pending2FAUser;
        delete data.pending2FASetup;
        delete data.oauth;
        delete data.passkey_challenge;
        data.user = {
          sub: userSub,
          authenticated_at: authTime,
        };
        if (rememberedOptions.enabled) {
          const existingAccounts = pruneRememberedAccounts(
            data.accounts ?? [],
            rememberedOptions,
          );
          data.accounts = [
            ...existingAccounts.filter((account) => account.sub !== userSub),
            {
              sub: userSub,
              authenticated_at: authTime,
              last_used_at: authTime,
            },
          ].slice(-rememberedOptions.maxAccounts);
        } else {
          delete data.accounts;
        }
      },
      selectUserSession(userSub: string): boolean {
        if (!rememberedOptions.enabled) {
          return false;
        }
        const account = pruneRememberedAccounts(
          data.accounts ?? [],
          rememberedOptions,
        ).find((entry) => entry.sub === userSub);
        if (!account) {
          return false;
        }
        delete data.pending2FAUser;
        delete data.pending2FASetup;
        delete data.oauth;
        delete data.passkey_challenge;
        data.user = {
          sub: account.sub,
          authenticated_at: account.authenticated_at,
        };
        data.accounts = pruneRememberedAccounts(
          data.accounts ?? [],
          rememberedOptions,
        ).map((entry) =>
          entry.sub === userSub
            ? { ...entry, last_used_at: nowSeconds() }
            : entry,
        );
        return true;
      },
      removeRememberedUserSession(userSub: string): boolean {
        if (data.user?.sub === userSub) {
          return false;
        }
        if (!rememberedOptions.enabled) {
          return false;
        }
        const existingAccounts = pruneRememberedAccounts(
          data.accounts ?? [],
          rememberedOptions,
        );
        const nextAccounts = existingAccounts.filter(
          (account) => account.sub !== userSub,
        );
        if (nextAccounts.length === existingAccounts.length) {
          return false;
        }
        data.accounts = nextAccounts;
        return true;
      },
      setPending2FASession(userSub: string, authenticatedAt?: number): void {
        delete data.user;
        delete data.pending2FASetup;
        data.pending2FAUser = {
          sub: userSub,
          authenticated_at: authenticatedAt ?? nowSeconds(),
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

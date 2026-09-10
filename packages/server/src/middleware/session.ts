import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { decrypt, encrypt } from '../lib/crypto.ts';
import { e } from '../schemas/error.js';
import type {
  SessionStore,
  StoredSession,
} from '../services/browser-session.service.js';

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

export interface ReauthenticationSession {
  sub?: string;
  authenticated_at?: number;
  request_fingerprint?: string;
}

export interface SessionData {
  totpSetupVerification?: { sub: string; totpId: string; step: number };
  security?: {
    grants: Record<string, string>;
    pendingExpiresAt?: number;
    challengeExpiresAt?: number;
    oauthExpiresAt?: number;
  };
  /**
   * Fully authenticated user session.
   * Set after successful login (password, OAuth, passkey) and 2FA verification.
   * Replaced when a different account completes authentication; retained while
   * another account is only in pending 2FA/setup state so multi-account sessions
   * do not unexpectedly lose their current active user.
   */
  user?: {
    sub: string;
    authenticated_at: number;
  };
  /**
   * Browser-local remembered authenticated accounts for OIDC account selection.
   * This is stored only in the server-side session and must never be
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
   * Server-side marker set by actual authentication completion. Public
   * continuation parameters are ignored unless they match this session value.
   */
  reauthentication?: ReauthenticationSession;
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
    linkSubject?: string;
    linkEpoch?: string;
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
  readonly id: string;
  readonly revision: number;
  readonly authorization: Readonly<SessionData>;
  atomic<T>(operation: () => Promise<T>): Promise<T>;
  get<K extends keyof SessionData>(key: K): SessionData[K];
  set<K extends keyof SessionData>(key: K, value: SessionData[K]): void;
  delete(): void;
  setUserSession(
    userSub: string,
    epoch: string,
    authenticatedAt?: number,
  ): void;
  selectUserSession(userSub: string): boolean;
  removeRememberedUserSession(userSub: string): boolean;
  setPending2FASession(
    userSub: string,
    epoch: string,
    authenticatedAt?: number,
  ): void;
  setPending2FASetupSession(userSub: string, epoch: string): void;
  clearAuthSessions(): void;
}

export function sessionMiddleware(
  cookieSecret: string,
  isSecure: boolean,
  rememberedAccountsOptions: RememberedAccountsOptions | undefined,
  store: SessionStore,
) {
  const rememberedOptions = resolveRememberedAccountsOptions(
    rememberedAccountsOptions,
  );
  return createMiddleware<SessionEnv>(async (c, next) => {
    const requestStartedAt = Date.now();
    const mainCookie = getCookie(c, 'session');
    const isFormPostCallback =
      c.req.method === 'POST' &&
      /^\/api\/oauth\/[^/]+\/callback$/.test(c.req.path);
    const cookieValue =
      mainCookie ??
      (isFormPostCallback ? getCookie(c, 'oauth_state') : undefined);
    let stored: StoredSession | null = null;
    let sessionData: SessionData = {};
    let locatorId: string | undefined;
    if (cookieValue) {
      const decrypted = await decrypt(cookieValue, cookieSecret);
      if (decrypted) {
        try {
          const locator = z
            .object({
              sid: z.uuid(),
              kind: z.literal(mainCookie ? 'session' : 'oauth'),
            })
            .parse(JSON.parse(decrypted));
          locatorId = locator.sid;
        } catch {
          sessionData = {};
        }
      }
    }
    if (store && locatorId) {
      stored = await store.load(locatorId);
      sessionData = stored?.data ?? {};
    }
    const sessionId = stored?.id ?? crypto.randomUUID();

    let changed = false;
    let elevated = false;
    if (store && sessionData.security) {
      const security = sessionData.security;
      if ((security.pendingExpiresAt ?? 0) <= requestStartedAt) {
        delete sessionData.pending2FAUser;
        delete sessionData.pending2FASetup;
      }
      if ((security.challengeExpiresAt ?? 0) <= requestStartedAt)
        delete sessionData.passkey_challenge;
      if ((security.oauthExpiresAt ?? 0) <= requestStartedAt)
        delete sessionData.oauth;
    }
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

    // A primary-authentication proof cannot renew an older MFA-completed grant.
    const replaceSubjectEpoch = (sub: string, epoch: string): void => {
      if (data.security?.grants[sub] !== epoch) {
        if (data.user?.sub === sub) delete data.user;
        if (data.pending2FAUser?.sub === sub) delete data.pending2FAUser;
        if (data.pending2FASetup?.sub === sub) delete data.pending2FASetup;
        if (data.reauthentication?.sub === sub) delete data.reauthentication;
        if (data.totpSetupVerification?.sub === sub)
          delete data.totpSetupVerification;
        if (data.accounts)
          data.accounts = data.accounts.filter(
            (account) => account.sub !== sub,
          );
        if (data.accountSelection)
          data.accountSelection = {
            ...data.accountSelection,
            allowed_subs: data.accountSelection.allowed_subs.filter(
              (value) => value !== sub,
            ),
          };
      }
      data.security ??= { grants: {} };
      data.security.grants[sub] = epoch;
    };

    let committed = false;
    let committedRecord: StoredSession | null = null;
    const persistSession = async (): Promise<StoredSession | null> => {
      const hasData = Object.entries(sessionData).some(
        ([key, value]) => key !== 'security' && value !== undefined,
      );
      if (!hasData) {
        if (stored) await store.remove(stored.id);
        return null;
      }
      const record: StoredSession = stored
        ? { ...stored, data: sessionData }
        : {
            id: sessionId,
            data: sessionData,
            revision: 0,
            expires_at: new Date(requestStartedAt + 86_400_000),
          };
      const previous =
        elevated && stored
          ? { id: stored.id, revision: stored.revision }
          : undefined;
      if (previous) {
        record.id = crypto.randomUUID();
        record.revision = 0;
      }
      if (!(await store.save(record, !stored, previous)))
        throw new e.Unauthorized.Error();
      return record;
    };
    c.set('session', {
      id: sessionId,
      revision: stored?.revision ?? 0,
      authorization: structuredClone(sessionData),
      async atomic<T>(operation: () => Promise<T>): Promise<T> {
        const before = structuredClone(sessionData);
        const wasChanged = changed;
        const wasElevated = elevated;
        try {
          const outcome = await store.transaction(async () => {
            const result = await operation();
            const record = await persistSession();
            return { result, record };
          });
          committed = true;
          committedRecord = outcome.record;
          changed = false;
          return outcome.result;
        } catch (error) {
          for (const key of Object.keys(sessionData))
            Reflect.deleteProperty(sessionData, key);
          Object.assign(sessionData, before);
          changed = wasChanged;
          elevated = wasElevated;
          throw error;
        }
      },
      get<K extends keyof SessionData>(key: K): SessionData[K] {
        return data[key];
      },
      set<K extends keyof SessionData>(key: K, value: SessionData[K]): void {
        data[key] = value;
        if (
          store &&
          value !== undefined &&
          (key === 'oauth' || key === 'passkey_challenge')
        ) {
          data.security ??= { grants: {} };
          if (key === 'oauth')
            data.security.oauthExpiresAt = requestStartedAt + 600_000;
          else data.security.challengeExpiresAt = requestStartedAt + 600_000;
        }
      },
      delete(): void {
        changed = true;
        for (const key of Object.keys(data)) {
          Reflect.deleteProperty(data, key);
        }
      },
      setUserSession(
        userSub: string,
        epoch: string,
        authenticatedAt?: number,
      ): void {
        if (
          (data.pending2FAUser?.sub === userSub ||
            data.pending2FASetup?.sub === userSub) &&
          data.security?.grants[userSub] !== epoch
        )
          throw new e.Unauthorized.Error();
        replaceSubjectEpoch(userSub, epoch);
        elevated = data.user?.sub !== userSub;
        const authTime = authenticatedAt ?? nowSeconds();
        const reauthenticationRequestFingerprint =
          data.reauthentication?.request_fingerprint;
        delete data.pending2FAUser;
        delete data.pending2FASetup;
        delete data.oauth;
        delete data.passkey_challenge;
        delete data.totpSetupVerification;
        data.user = {
          sub: userSub,
          authenticated_at: authTime,
        };
        data.reauthentication = {
          sub: userSub,
          authenticated_at: authTime,
        };
        if (reauthenticationRequestFingerprint) {
          data.reauthentication.request_fingerprint =
            reauthenticationRequestFingerprint;
        }
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
        delete data.totpSetupVerification;
        data.user = {
          sub: account.sub,
          authenticated_at: account.authenticated_at,
        };
        delete data.reauthentication;
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
      setPending2FASession(
        userSub: string,
        epoch: string,
        authenticatedAt?: number,
      ): void {
        if (store) {
          replaceSubjectEpoch(userSub, epoch);
          data.security ??= { grants: {} };
          data.security.pendingExpiresAt = requestStartedAt + 600_000;
        }
        delete data.pending2FASetup;
        delete data.oauth;
        delete data.passkey_challenge;
        delete data.totpSetupVerification;
        data.pending2FAUser = {
          sub: userSub,
          authenticated_at: authenticatedAt ?? nowSeconds(),
        };
      },
      setPending2FASetupSession(userSub: string, epoch: string): void {
        if (store) {
          replaceSubjectEpoch(userSub, epoch);
          data.security ??= { grants: {} };
          data.security.pendingExpiresAt = requestStartedAt + 600_000;
        }
        delete data.pending2FAUser;
        delete data.oauth;
        delete data.passkey_challenge;
        delete data.totpSetupVerification;
        data.pending2FASetup = { sub: userSub };
      },
      clearAuthSessions(): void {
        delete data.totpSetupVerification;
        delete data.user;
        delete data.reauthentication;
        delete data.pending2FAUser;
        delete data.pending2FASetup;
      },
    });

    await next();

    if (changed || committed) {
      const record = committed ? committedRecord : await persistSession();
      if (record) {
        const encrypted = await encrypt(
          JSON.stringify({ sid: record.id, kind: 'session' }),
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

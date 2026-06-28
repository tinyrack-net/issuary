import { createMiddleware } from 'hono/factory';
import type { UserEntity } from '../entities/user.entity.ts';
import { e, TinyAuthError } from '../schemas/error.ts';
import type { ServicesEnv } from './services.ts';
import type { SessionData, SessionEnv } from './session.ts';

export interface VerifiedAuth {
  user: UserEntity;
  authenticatedAt: number;
}

export interface VerifiedPending2FA {
  user: UserEntity;
  authenticatedAt: number;
}

export interface VerifiedPending2FASetup {
  user: UserEntity;
}

type VerifiedAuthEnv<Optional extends boolean> = {
  Variables: {
    verifiedUser: Optional extends true
      ? VerifiedAuth | undefined
      : VerifiedAuth;
  };
};

export const verifyAuth = <Optional extends boolean = false>(options?: {
  optional?: Optional;
}) =>
  createMiddleware<{
    Variables: SessionEnv['Variables'] &
      ServicesEnv['Variables'] &
      VerifiedAuthEnv<Optional>['Variables'];
  }>(async (c, next) => {
    const services = c.var.services;
    const sessionHelper = c.var.session;
    const session = sessionHelper.get('user');
    if (!session) {
      if (options?.optional) {
        c.set('verifiedUser', undefined as never);
        await next();
        return;
      }
      throw new e.Unauthorized.Error();
    }
    try {
      const userEntity = await services.mikro.user.findBySub(session.sub);
      c.set('verifiedUser', {
        user: userEntity,
        authenticatedAt: session.authenticated_at,
      });
    } catch (err) {
      if (err instanceof TinyAuthError && err.code === 'USER_NOT_FOUND') {
        sessionHelper.set('user', undefined);
        if (options?.optional) {
          c.set('verifiedUser', undefined as never);
          await next();
          return;
        }
        throw new e.Unauthorized.Error();
      }
      throw err;
    }
    await next();
  });

export const requireAdmin = () =>
  createMiddleware<{
    Variables: SessionEnv['Variables'] &
      ServicesEnv['Variables'] &
      VerifiedAuthEnv<false>['Variables'];
  }>(async (c, next) => {
    const services = c.var.services;
    const sessionHelper = c.var.session;
    const session = sessionHelper.get('user');
    if (!session) {
      throw new e.Unauthorized.Error();
    }

    try {
      const userEntity = await services.mikro.user.findBySub(session.sub);
      if (userEntity.role !== 'admin') {
        throw new e.Forbidden.Error();
      }
      c.set('verifiedUser', {
        user: userEntity,
        authenticatedAt: session.authenticated_at,
      });
    } catch (err) {
      if (err instanceof TinyAuthError && err.code === 'USER_NOT_FOUND') {
        sessionHelper.set('user', undefined);
        throw new e.Unauthorized.Error();
      }
      throw err;
    }

    await next();
  });

type VerifiedPending2FAUserEnv<Optional extends boolean> = {
  Variables: {
    verifiedPending2FAUser: Optional extends true
      ? VerifiedPending2FA | undefined
      : VerifiedPending2FA;
  };
};

export const verifyPending2FAUser = <
  Optional extends boolean = false,
>(options?: {
  optional?: Optional;
}) =>
  createMiddleware<{
    Variables: SessionEnv['Variables'] &
      ServicesEnv['Variables'] &
      VerifiedPending2FAUserEnv<Optional>['Variables'];
  }>(async (c, next) => {
    const services = c.var.services;
    const sessionHelper = c.var.session;
    const session = sessionHelper.get('pending2FAUser');
    if (!session) {
      if (options?.optional) {
        c.set('verifiedPending2FAUser', undefined as never);
        await next();
        return;
      }
      throw new e.Unauthorized.Error();
    }
    try {
      const userEntity = await services.mikro.user.findBySub(session.sub);
      c.set('verifiedPending2FAUser', {
        user: userEntity,
        authenticatedAt: session.authenticated_at,
      });
    } catch (err) {
      if (err instanceof TinyAuthError && err.code === 'USER_NOT_FOUND') {
        sessionHelper.set('pending2FAUser', undefined);
        if (options?.optional) {
          c.set('verifiedPending2FAUser', undefined as never);
          await next();
          return;
        }
        throw new e.Unauthorized.Error();
      }
      throw err;
    }
    await next();
  });

type VerifiedPending2FASetupUserEnv<Optional extends boolean> = {
  Variables: {
    verifiedPending2FASetupUser: Optional extends true
      ? VerifiedPending2FASetup | undefined
      : VerifiedPending2FASetup;
  };
};

export const verifyPending2FASetupUser = <
  Optional extends boolean = false,
>(options?: {
  optional?: Optional;
}) =>
  createMiddleware<{
    Variables: SessionEnv['Variables'] &
      ServicesEnv['Variables'] &
      VerifiedPending2FASetupUserEnv<Optional>['Variables'];
  }>(async (c, next) => {
    const services = c.var.services;
    const sessionHelper = c.var.session;
    const session = sessionHelper.get('pending2FASetup');
    if (!session) {
      if (options?.optional) {
        c.set('verifiedPending2FASetupUser', undefined as never);
        await next();
        return;
      }
      throw new e.Unauthorized.Error();
    }
    try {
      const userEntity = await services.mikro.user.findBySub(session.sub);
      c.set('verifiedPending2FASetupUser', { user: userEntity });
    } catch (err) {
      if (err instanceof TinyAuthError && err.code === 'USER_NOT_FOUND') {
        sessionHelper.set('pending2FASetup', undefined);
        if (options?.optional) {
          c.set('verifiedPending2FASetupUser', undefined as never);
          await next();
          return;
        }
        throw new e.Unauthorized.Error();
      }
      throw err;
    }
    await next();
  });

type VerifiedPasskeyChallengeEnv = {
  Variables: {
    verifiedPasskeyChallenge: string;
  };
};

export const verifyPasskeyChallenge = () =>
  createMiddleware<{
    Variables: SessionEnv['Variables'] &
      VerifiedPasskeyChallengeEnv['Variables'];
  }>(async (c, next) => {
    const sessionHelper = c.var.session;
    const challenge = sessionHelper.get('passkey_challenge');
    if (!challenge) {
      throw new e.PasskeyChallengeNotFound.Error();
    }
    sessionHelper.set('passkey_challenge', undefined);
    c.set('verifiedPasskeyChallenge', challenge);
    await next();
  });

type VerifiedOAuthEnv<Optional extends boolean> = {
  Variables: {
    verifiedOAuth: Optional extends true
      ? NonNullable<SessionData['oauth']> | undefined
      : NonNullable<SessionData['oauth']>;
  };
};

export const verifyOAuth = <Optional extends boolean = false>(options?: {
  optional?: Optional;
}) =>
  createMiddleware<{
    Variables: SessionEnv['Variables'] &
      VerifiedOAuthEnv<Optional>['Variables'];
  }>(async (c, next) => {
    const sessionHelper = c.var.session;
    const oauth = sessionHelper.get('oauth');
    if (!oauth) {
      if (options?.optional) {
        c.set('verifiedOAuth', undefined as never);
        await next();
        return;
      }
      throw new e.OAuthSessionExpired.Error();
    }
    c.set('verifiedOAuth', oauth);
    await next();
  });

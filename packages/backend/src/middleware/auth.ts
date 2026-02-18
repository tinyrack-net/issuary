import { ApiError, e } from '@backend/schemas/error.js';
import type { r } from '@backend/schemas/response.js';
import { createMiddleware } from 'hono/factory';
import type z from 'zod';
import type { ServicesEnv } from './services.js';
import type { SessionEnv } from './session.js';

type VerifiedAuthEnv<Optional extends boolean> = {
  Variables: {
    verifiedUser: Optional extends true
      ? z.infer<typeof r.UserSession> | undefined
      : z.infer<typeof r.UserSession>;
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
    const session = c.var.session;
    const userId = session.get('user')?.id;
    if (!userId) {
      if (options?.optional) {
        c.set('verifiedUser', undefined as never);
        await next();
        return;
      }
      throw new e.Unauthorized.Error();
    }
    try {
      const userEntity = await services.mikro.user.verifyById(userId);
      const sessionUser =
        await services.userService.userEntityToSessionUser(userEntity);
      c.set('verifiedUser', sessionUser);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'USER_NOT_FOUND') {
        session.clearAuthSessions();
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

type VerifiedPending2FAUserEnv<Optional extends boolean> = {
  Variables: {
    verifiedPending2FAUser: Optional extends true
      ? z.infer<typeof r.UserSession> | undefined
      : z.infer<typeof r.UserSession>;
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
    const session = c.var.session;
    const userId = session.get('pending2FAUser')?.id;
    if (!userId) {
      if (options?.optional) {
        c.set('verifiedPending2FAUser', undefined as never);
        await next();
        return;
      }
      throw new e.Unauthorized.Error();
    }
    try {
      const userEntity = await services.mikro.user.verifyById(userId);
      const sessionUser =
        await services.userService.userEntityToSessionUser(userEntity);
      c.set('verifiedPending2FAUser', sessionUser);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'USER_NOT_FOUND') {
        session.clearAuthSessions();
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
      ? z.infer<typeof r.UserSession> | undefined
      : z.infer<typeof r.UserSession>;
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
    const session = c.var.session;
    const userId = session.get('pending2FASetup')?.id;
    if (!userId) {
      if (options?.optional) {
        c.set('verifiedPending2FASetupUser', undefined as never);
        await next();
        return;
      }
      throw new e.Unauthorized.Error();
    }
    try {
      const userEntity = await services.mikro.user.verifyById(userId);
      const sessionUser =
        await services.userService.userEntityToSessionUser(userEntity);
      c.set('verifiedPending2FASetupUser', sessionUser);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'USER_NOT_FOUND') {
        session.clearAuthSessions();
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

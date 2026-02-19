import type { UserEntity } from '@backend/entities/user.entity.js';
import { ApiError, e } from '@backend/schemas/error.js';
import { createMiddleware } from 'hono/factory';
import type { ServicesEnv } from './services.js';
import type { SessionEnv } from './session.js';

type VerifiedAuthEnv<Optional extends boolean> = {
  Variables: {
    verifiedUser: Optional extends true ? UserEntity | undefined : UserEntity;
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
      const userEntity = await services.mikro.user.findById(userId);
      c.set('verifiedUser', userEntity);
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
      ? UserEntity | undefined
      : UserEntity;
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
      const userEntity = await services.mikro.user.findById(userId);
      c.set('verifiedPending2FAUser', userEntity);
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
      ? UserEntity | undefined
      : UserEntity;
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
      const userEntity = await services.mikro.user.findById(userId);
      c.set('verifiedPending2FASetupUser', userEntity);
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

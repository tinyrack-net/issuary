import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../lib/app-env.ts';
import { e, TinyAuthError } from '../schemas/error.ts';
import type { VerifiedAuth } from './auth.ts';

export type AdminAuthEnv = {
  Variables: {
    verifiedAdmin: VerifiedAuth;
  };
};

export const verifyAdmin = () =>
  createMiddleware<{
    Variables: AppEnv['Variables'] & AdminAuthEnv['Variables'];
  }>(async (c, next) => {
    const services = c.var.services;
    const sessionHelper = c.var.session;
    const session = sessionHelper.get('user');

    if (!session) {
      throw new e.Unauthorized.Error();
    }

    try {
      const userEntity = await services.mikro.user.findOneOrFail(
        { sub: session.sub, deleted_at: null },
        { failHandler: () => new e.UserNotFound.Error() },
      );
      if (userEntity.role !== 'admin') {
        throw new e.Forbidden.Error();
      }

      c.set('verifiedAdmin', {
        user: userEntity,
        authenticatedAt: session.authenticated_at,
      });
    } catch (err) {
      if (err instanceof TinyAuthError && err.code === 'USER_NOT_FOUND') {
        sessionHelper.clearAuthSessions();
        throw new e.Unauthorized.Error();
      }

      throw err;
    }

    await next();
  });

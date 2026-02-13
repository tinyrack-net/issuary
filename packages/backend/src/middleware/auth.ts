import { createMiddleware } from 'hono/factory';
import type z from 'zod';
import type { AppEnv } from '@/lib/app.js';
import { e } from '@/schemas/error.js';
import type { r } from '@/schemas/response.js';

export interface AuthHelper {
  verify: () => Promise<z.infer<typeof r.UserSession>>;
  verifyPending2FAUser: () => Promise<z.infer<typeof r.UserSession>>;
  verifyPending2FASetupUser: () => Promise<z.infer<typeof r.UserSession>>;
}

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const services = c.get('services');
  const session = c.get('session');

  c.set('auth', {
    verify: async () => {
      const userId = session.get('user')?.id;
      if (!userId) {
        throw new e.Unauthorized.Error();
      }
      const userEntity = await services.mikro.user.verifyById(userId);
      return services.userService.userEntityToSessionUser(userEntity);
    },
    verifyPending2FAUser: async () => {
      const userId = session.get('pending2FAUser')?.id;
      if (!userId) {
        throw new e.Unauthorized.Error();
      }
      const userEntity = await services.mikro.user.verifyById(userId);
      return services.userService.userEntityToSessionUser(userEntity);
    },
    verifyPending2FASetupUser: async () => {
      const userId = session.get('pending2FASetup')?.id;
      if (!userId) {
        throw new e.Unauthorized.Error();
      }
      const userEntity = await services.mikro.user.verifyById(userId);
      return services.userService.userEntityToSessionUser(userEntity);
    },
  });

  await next();
});

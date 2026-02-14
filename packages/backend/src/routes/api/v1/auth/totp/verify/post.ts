import { createRoute, z } from '@hono/zod-openapi';
import { createRouter } from '@/lib/create-router.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';

const route = createRoute({
  method: 'post',
  path: '/auth/totp/verify',
  tags: [TAGS.AUTH],
  summary: 'Verify TOTP for login',
  description:
    'Complete login by verifying TOTP code. Requires pending 2FA session from password login.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            code: f.totpCode,
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: r.UserSessionResponse,
        },
      },
      description: 'Success',
    },
    400: {
      content: {
        'application/json': {
          schema: e.ValidationError.Schema,
        },
      },
      description: 'Validation error or invalid TOTP code',
    },
    401: {
      content: {
        'application/json': {
          schema: e.SecondFactorSessionExpired.Schema,
        },
      },
      description: 'Second factor session expired',
    },
  },
});

export default createRouter().openapi(route, async (c) => {
  const config = c.get('services').config;
  if (!config.auth.password.enabled || !config.auth.password.totp.enabled) {
    throw new e.ValidationError.Error('TOTP authentication is disabled');
  }

  const body = c.req.valid('json');
  const session = c.get('session');
  const { mikro, totpService, userService } = c.get('services');

  const pending2FAUser = session.get('pending2FAUser');

  if (!pending2FAUser) {
    throw new e.SecondFactorSessionExpired.Error();
  }

  await totpService.verifyForAuth(pending2FAUser.id, body.code);

  const userEntity = await mikro.user.verifyById(pending2FAUser.id);
  const user = await userService.userEntityToSessionUser(userEntity);

  const authTime =
    pending2FAUser.authenticated_at ?? Math.floor(Date.now() / 1000);

  session.setUserSession(user.id, authTime);

  return c.json({ user }, 200);
});

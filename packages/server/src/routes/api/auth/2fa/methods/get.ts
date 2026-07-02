import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../../../lib/openapi.ts';
import { TAGS } from '../../../../../lib/swagger-tags.ts';
import { verifyPending2FAUser } from '../../../../../middleware/auth.ts';
import { e } from '../../../../../schemas/error.ts';

const SecondFactorMethod = z.enum(['totp', 'passkey']);

export const authSecondFactorMethodsGet = new Hono<AppEnv>().get(
  '/auth/2fa/methods',
  describeRoute({
    tags: [TAGS.AUTH],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Get pending 2FA methods',
    description:
      'Return registered and enabled second factor methods for the pending 2FA session.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(
              z.object({
                methods: z.array(SecondFactorMethod),
              }),
            ),
          },
        },
        description: 'Success',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.SecondFactorSessionExpired.Schema),
          },
        },
        description: 'Second factor session expired',
      },
    },
  }),
  verifyPending2FAUser(),
  async (c) => {
    const { services } = c.var;
    const { user } = c.var.verifiedPending2FAUser;
    const registeredMethods =
      await services.userService.userRegistered2FAMethods(user.sub);
    const methods: z.infer<typeof SecondFactorMethod>[] = [];

    if (
      services.config.auth.password.enabled &&
      services.config.auth.password.totp.enabled &&
      registeredMethods.includes('totp')
    ) {
      methods.push('totp');
    }

    if (
      services.config.auth.passkey.enabled &&
      registeredMethods.includes('passkey')
    ) {
      methods.push('passkey');
    }

    return c.json({ methods }, 200);
  },
);

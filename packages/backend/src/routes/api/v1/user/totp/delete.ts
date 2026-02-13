import { createRoute } from '@hono/zod-openapi';
import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { AppType } from '@/types.js';

/**
 * DELETE /api/v1/user/totp
 *
 * Disable TOTP two-factor authentication.
 */
const route = createRoute({
  method: 'delete',
  path: '/user/totp',
  tags: [TAGS.USER],
  summary: 'Disable TOTP',
  description:
    'Disable TOTP two-factor authentication for the current user. ' +
    'Requires a valid TOTP code from the authenticator app.',
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
        'application/json': { schema: r.OkResponse },
      },
      description: 'Success',
    },
    400: {
      content: {
        'application/json': {
          schema: e.TotpNotEnabled.Schema,
        },
      },
      description:
        'TOTP not enabled, invalid code, or cannot remove last second factor',
    },
    401: {
      content: {
        'application/json': {
          schema: e.Unauthorized.Schema,
        },
      },
      description: 'Unauthorized',
    },
    403: {
      content: {
        'application/json': {
          schema: e.SecondFactorNotAllowedForConfigUser.Schema,
        },
      },
      description: 'Second factor not allowed for config user',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    const body = c.req.valid('json');
    const auth = c.get('auth');
    const { config, mikro, totpService } = c.get('services');

    const userSession = await auth.verify();

    // Config users cannot manage 2FA
    if (userSession.managed_by === 'config') {
      throw new e.SecondFactorNotAllowedForConfigUser.Error();
    }

    // Check if 2FA is required
    const secondFactorRequired = config.auth.password.second_factor.required;

    // Check if user has other 2FA method (passkey)
    const passkeyCount = await mikro.userPasskey.countByUserId(userSession.id);
    const hasOtherSecondFactor = passkeyCount > 0;

    await totpService.disable(userSession.id, body.code, {
      secondFactorRequired,
      hasOtherSecondFactor,
    });

    return c.json({ ok: true as const }, 200);
  });
};

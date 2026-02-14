import { createRouter } from '@backend/lib/create-router.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { createRoute, z } from '@hono/zod-openapi';

const route = createRoute({
  method: 'delete',
  path: '/user/passkeys/{id}',
  tags: [TAGS.USER],
  summary: 'Delete Passkey',
  description: 'Delete a passkey by ID',
  request: {
    params: z.object({
      id: f.uuid,
    }),
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
          schema: e.PasskeyNotEnabled.Schema,
        },
      },
      description:
        'Passkey not enabled, cannot remove last passkey, or cannot remove last second factor',
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
    404: {
      content: {
        'application/json': {
          schema: e.PasskeyNotFound.Schema,
        },
      },
      description: 'Passkey not found',
    },
  },
});

export default createRouter().openapi(route, async (c) => {
  const config = c.get('services').config;
  if (!config.auth.passkey.enabled) {
    throw new e.PasskeyNotEnabled.Error();
  }

  const params = c.req.valid('param');
  const auth = c.get('auth');
  const { mikro, passkeyService } = c.get('services');

  const userSession = await auth.verify();

  // Config users cannot manage 2FA
  if (userSession.managed_by === 'config') {
    throw new e.SecondFactorNotAllowedForConfigUser.Error();
  }

  // Check if user has other auth methods
  const user = await mikro.user.findOneOrFail(
    { id: userSession.id },
    { populate: ['password_hash'] },
  );
  const hasLinkedOAuth =
    (await mikro.userOAuth.count({
      user: { id: user.id },
    })) > 0;
  const hasOtherAuthMethods = user.hasPassword() || hasLinkedOAuth;

  // Check if 2FA is required
  const secondFactorRequired = config.auth.password.second_factor.required;

  // Check if user has other 2FA method (TOTP)
  const totpEnabled = await mikro.userTotp.isRegistered(userSession.id);

  // Delete passkey
  await passkeyService.deletePasskey(userSession.id, params.id, {
    hasOtherAuthMethods,
    secondFactorRequired,
    hasOtherSecondFactor: totpEnabled,
  });

  return c.json({ ok: true as const }, 200);
});

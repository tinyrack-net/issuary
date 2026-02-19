import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { verifyAuth } from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

export const userPasskeyIdDelete = new Hono<AppEnv>().delete(
  '/user/passkeys/:id',
  describeRoute({
    tags: [TAGS.USER],
    summary: 'Delete Passkey',
    description: 'Delete a passkey by ID',
    responses: {
      200: {
        content: {
          'application/json': { schema: resolver(r.OkResponse) },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.PasskeyNotEnabled.Schema),
          },
        },
        description:
          'Passkey not enabled, cannot remove last passkey, or cannot remove last second factor',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.Unauthorized.Schema),
          },
        },
        description: 'Unauthorized',
      },
      403: {
        content: {
          'application/json': {
            schema: resolver(e.SecondFactorNotAllowedForConfigUser.Schema),
          },
        },
        description: 'Second factor not allowed for config user',
      },
      404: {
        content: {
          'application/json': {
            schema: resolver(e.PasskeyNotFound.Schema),
          },
        },
        description: 'Passkey not found',
      },
    },
  }),
  validator(
    'param',
    z.object({
      id: f.uuid,
    }),
  ),
  verifyAuth(),
  async (c) => {
    const config = c.var.services.config;
    if (!config.auth.passkey.enabled) {
      throw new e.PasskeyNotEnabled.Error();
    }

    const params = c.req.valid('param');
    const userEntity = c.var.verifiedUser;
    const { mikro, passkeyService } = c.var.services;

    // Config users cannot manage 2FA
    if (userEntity.managed_by === 'config') {
      throw new e.SecondFactorNotAllowedForConfigUser.Error();
    }

    // Load password_hash to check auth methods
    await mikro.em.populate(userEntity, ['password_hash']);
    const hasLinkedOAuth =
      (await mikro.userOAuth.count({
        user: { id: userEntity.id },
      })) > 0;
    const hasOtherAuthMethods = userEntity.hasPassword() || hasLinkedOAuth;

    // Check if 2FA is required
    const secondFactorRequired = config.auth.password.second_factor.required;

    // Check if user has other 2FA method (TOTP)
    const totpEnabled = await mikro.userTotp.isRegistered(userEntity.id);

    // Delete passkey
    await passkeyService.deletePasskey(userEntity.id, params.id, {
      hasOtherAuthMethods,
      secondFactorRequired,
      hasOtherSecondFactor: totpEnabled,
    });

    return c.json({ ok: true as const }, 200);
  },
);

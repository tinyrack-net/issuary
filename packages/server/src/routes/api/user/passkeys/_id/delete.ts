import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../../lib/app-env.ts';
import {
  OPENAPI_SECURITY,
  securityMutationDocumentation,
} from '../../../../../lib/openapi.ts';
import { TAGS } from '../../../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../../../middleware/auth.ts';
import { e } from '../../../../../schemas/error.ts';
import { f } from '../../../../../schemas/field.ts';
import { r } from '../../../../../schemas/response.ts';
import { withBrowserSecurity } from '../../../../../services/browser-security.service.js';

export const userPasskeyIdDelete = new Hono<AppEnv>().delete(
  '/user/passkeys/:id',
  describeRoute({
    tags: [TAGS.USER],
    security: OPENAPI_SECURITY.cookieSession,
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
  securityMutationDocumentation,
  async (c) => {
    return withBrowserSecurity(c, async () => {
      const config = c.var.services.config;
      if (!config.auth.passkey.enabled) {
        throw new e.PasskeyNotEnabled.Error();
      }

      const params = c.req.valid('param');
      const { user: userEntity } = c.var.verifiedUser;
      const { passkeyService } = c.var.services;

      // Config users cannot manage 2FA
      if (userEntity.managed_by === 'config') {
        throw new e.SecondFactorNotAllowedForConfigUser.Error();
      }

      await passkeyService.deletePasskey(userEntity.sub, params.id);

      return c.json({ ok: true as const }, 200);
    });
  },
);

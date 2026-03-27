import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../../lib/openapi.ts';
import { TAGS } from '../../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../../middleware/auth.ts';
import { e } from '../../../../schemas/error.ts';
import { f } from '../../../../schemas/field.ts';
import { r } from '../../../../schemas/response.ts';

/**
 * DELETE /api/user/password
 *
 * Remove password for users who have at least one OAuth account linked.
 */
export const userPasswordDelete = new Hono<AppEnv>().delete(
  '/user/password',
  describeRoute({
    tags: [TAGS.USER],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Remove Password',
    description:
      'Remove password for users who have at least one OAuth account linked. ' +
      'Requires current password verification and at least one OAuth account.',
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
            schema: resolver(
              z.union([
                e.PasswordNotSet.Schema,
                e.CannotRemoveLastAuthMethod.Schema,
                e.CannotRemovePasswordWithSecondFactorOnly.Schema,
                e.ValidationError.Schema,
              ]),
            ),
          },
        },
        description:
          'Password not set, password auth disabled, cannot remove last auth method, or cannot remove password with second factor only',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(
              z.union([e.Unauthorized.Schema, e.InvalidCurrentPassword.Schema]),
            ),
          },
        },
        description: 'Unauthorized or invalid current password',
      },
      403: {
        content: {
          'application/json': {
            schema: resolver(e.UserNotEditable.Schema),
          },
        },
        description: 'User not editable',
      },
      404: {
        content: {
          'application/json': {
            schema: resolver(e.UserNotFound.Schema),
          },
        },
        description: 'User not found',
      },
    },
  }),
  validator(
    'json',
    z.object({
      current_password: f.userPassword,
    }),
  ),
  verifyAuth(),
  async (c) => {
    const body = c.req.valid('json');
    const { config, passwordAuthService } = c.var.services;
    const { user } = c.var.verifiedUser;

    if (!config.auth.password.enabled) {
      throw new e.ValidationError.Error('Password authentication is disabled');
    }

    await passwordAuthService.removePassword(user, body.current_password);

    return c.json({ ok: true as const }, 200);
  },
);

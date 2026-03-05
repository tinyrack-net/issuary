import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '#backend/lib/app-env.js';
import { OPENAPI_SECURITY } from '#backend/lib/openapi.js';
import { TAGS } from '#backend/lib/swagger-tags.js';
import { verifyAuth } from '#backend/middleware/auth.js';
import { e } from '#backend/schemas/error.js';
import { f } from '#backend/schemas/field.js';
import { r } from '#backend/schemas/response.js';

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

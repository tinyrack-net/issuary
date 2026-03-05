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
 * PUT /api/user/password
 *
 * Change password for users who already have a password set.
 */
export const userPasswordPut = new Hono<AppEnv>().put(
  '/user/password',
  describeRoute({
    tags: [TAGS.USER],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Change Password',
    description:
      'Change password for users who already have a password set. ' +
      'Requires current password verification.',
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
              z.union([e.PasswordNotSet.Schema, e.ValidationError.Schema]),
            ),
          },
        },
        description: 'Password not set or password auth disabled',
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
      new_password: f.newUserPassword,
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

    await passwordAuthService.changePassword(
      user,
      body.current_password,
      body.new_password,
    );

    return c.json({ ok: true as const }, 200);
  },
);

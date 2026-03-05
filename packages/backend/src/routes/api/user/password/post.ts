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
 * POST /api/user/password
 *
 * Set password for OAuth-only users.
 */
export const userPasswordPost = new Hono<AppEnv>().post(
  '/user/password',
  describeRoute({
    tags: [TAGS.USER],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Set Password',
    description:
      'Set a password for users who signed up via OAuth. ' +
      'Only works if no password is currently set.',
    responses: {
      200: {
        content: {
          'application/json': { schema: resolver(r.OkResponse) },
        },
        description: 'Success',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.Unauthorized.Schema),
          },
        },
        description: 'Unauthorized',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.ValidationError.Schema),
          },
        },
        description: 'Password authentication disabled or validation error',
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
      409: {
        content: {
          'application/json': {
            schema: resolver(e.PasswordAlreadySet.Schema),
          },
        },
        description: 'Password already set',
      },
    },
  }),
  validator(
    'json',
    z.object({
      password: f.newUserPassword,
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

    await passwordAuthService.setPasswordForUser(user, body.password);

    return c.json({ ok: true as const }, 200);
  },
);

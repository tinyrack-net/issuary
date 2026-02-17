import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { verifyAuth } from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

/**
 * POST /api/user/password
 *
 * Set password for OAuth-only users.
 */
export const userPasswordPost = new Hono<AppEnv>().post(
  '/user/password',
  describeRoute({
    tags: [TAGS.USER],
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
      password: f.userPassword,
    }),
  ),
  verifyAuth(),
  async (c) => {
    const body = c.req.valid('json');
    const userSession = c.get('verifiedUser');
    const { mikro } = c.get('services');

    // Config users cannot set password
    if (userSession.managed_by === 'config') {
      throw new e.UserNotEditable.Error();
    }

    // Get user with password_hash
    const user = await mikro.user.findOneOrFail(
      { id: userSession.id },
      {
        populate: ['password_hash'],
        failHandler: () => new e.UserNotFound.Error(),
      },
    );

    // Check if user is config-managed
    if (user.managed_by === 'config') {
      throw new e.UserNotEditable.Error();
    }

    // Check if password is already set
    if (user.hasPassword()) {
      throw new e.PasswordAlreadySet.Error();
    }

    // Set new password
    user.password_hash = body.password;
    await mikro.em.flush();

    return c.json({ ok: true as const }, 200);
  },
);

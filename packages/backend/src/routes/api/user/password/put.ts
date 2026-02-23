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
 * PUT /api/user/password
 *
 * Change password for users who already have a password set.
 */
export const userPasswordPut = new Hono<AppEnv>().put(
  '/user/password',
  describeRoute({
    tags: [TAGS.USER],
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
            schema: resolver(e.PasswordNotSet.Schema),
          },
        },
        description: 'Password not set',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.Unauthorized.Schema),
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
      new_password: f.userPassword,
    }),
  ),
  verifyAuth(),
  async (c) => {
    const body = c.req.valid('json');
    const { user } = c.var.verifiedUser;
    const { mikro } = c.var.services;

    // Config users cannot change password
    if (user.managed_by === 'config') {
      throw new e.UserNotEditable.Error();
    }

    // Load password_hash for password operations
    await mikro.em.populate(user, ['password_hash']);

    // Check if password is set
    if (!user.hasPassword()) {
      throw new e.PasswordNotSet.Error();
    }

    // Verify current password
    const isValid = await user.verifyPassword(body.current_password);
    if (!isValid) {
      throw new e.InvalidCurrentPassword.Error();
    }

    // Set new password
    user.password_hash = body.new_password;
    await mikro.em.flush();

    return c.json({ ok: true as const }, 200);
  },
);

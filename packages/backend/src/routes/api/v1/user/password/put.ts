import { createRoute, z } from '@hono/zod-openapi';
import type { AppType } from '@/lib/app.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';

/**
 * PUT /api/v1/user/password
 *
 * Change password for users who already have a password set.
 */
const route = createRoute({
  method: 'put',
  path: '/user/password',
  tags: [TAGS.USER],
  summary: 'Change Password',
  description:
    'Change password for users who already have a password set. ' +
    'Requires current password verification.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            current_password: f.userPassword,
            new_password: f.userPassword,
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
          schema: e.PasswordNotSet.Schema,
        },
      },
      description: 'Password not set',
    },
    401: {
      content: {
        'application/json': {
          schema: e.Unauthorized.Schema,
        },
      },
      description: 'Unauthorized or invalid current password',
    },
    403: {
      content: {
        'application/json': {
          schema: e.UserNotEditable.Schema,
        },
      },
      description: 'User not editable',
    },
    404: {
      content: {
        'application/json': {
          schema: e.UserNotFound.Schema,
        },
      },
      description: 'User not found',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    const body = c.req.valid('json');
    const auth = c.get('auth');
    const { mikro } = c.get('services');

    const userSession = await auth.verify();

    // Config users cannot change password
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
  });
};

import { createRoute, z } from '@hono/zod-openapi';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { AppType } from '@/types.js';

/**
 * POST /api/v1/user/password
 *
 * Set password for OAuth-only users.
 */
const route = createRoute({
  method: 'post',
  path: '/user/password',
  tags: [TAGS.USER],
  summary: 'Set Password',
  description:
    'Set a password for users who signed up via OAuth. ' +
    'Only works if no password is currently set.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            password: f.userPassword,
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
    409: {
      content: {
        'application/json': {
          schema: e.PasswordAlreadySet.Schema,
        },
      },
      description: 'Password already set',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    const body = c.req.valid('json');
    const auth = c.get('auth');
    const { mikro } = c.get('services');

    const userSession = await auth.verify();

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
  });
};

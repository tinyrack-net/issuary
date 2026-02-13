import { createRoute } from '@hono/zod-openapi';
import z from 'zod';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { AppType } from '@/types.js';

/**
 * DELETE /api/v1/user/password
 *
 * Remove password for users who have at least one OAuth account linked.
 */
const route = createRoute({
  method: 'delete',
  path: '/user/password',
  tags: [TAGS.USER],
  summary: 'Remove Password',
  description:
    'Remove password for users who have at least one OAuth account linked. ' +
    'Requires current password verification and at least one OAuth account.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            current_password: f.userPassword,
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
      description:
        'Password not set, cannot remove last auth method, or cannot remove password with second factor only',
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

    // Config users cannot remove password
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

    // Check if user has at least one OAuth account
    const oauthCount = await mikro.userOAuth.countByUser(user.id);

    // Check if user has 2FA enabled (TOTP or Passkey)
    const hasTotp = await mikro.userTotp.isRegistered(user.id);
    const passkeyCount = await mikro.userPasskey.countByUserId(user.id);
    const hasSecondFactor = hasTotp || passkeyCount > 0;

    // Cannot remove password if:
    // 1. No OAuth accounts
    // 2. Has 2FA but no OAuth
    if (oauthCount === 0) {
      if (hasSecondFactor) {
        throw new e.CannotRemovePasswordWithSecondFactorOnly.Error();
      }
      throw new e.CannotRemoveLastAuthMethod.Error();
    }

    // Remove password
    user.password_hash = null;
    await mikro.em.flush();

    return c.json({ ok: true as const }, 200);
  });
};

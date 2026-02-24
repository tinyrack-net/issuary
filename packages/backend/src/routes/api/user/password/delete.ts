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
    const { config } = c.var.services;
    const { user } = c.var.verifiedUser;
    const { mikro } = c.var.services;

    if (!config.auth.password.enabled) {
      throw new e.ValidationError.Error('Password authentication is disabled');
    }

    // Config users cannot remove password
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

    // Check if user has at least one OAuth account
    const oauthCount = await mikro.userOAuth.countByUser(user.sub);

    // Check if user has 2FA enabled (TOTP or Passkey)
    const hasTotp = await mikro.userTotp.isRegistered(user.sub);
    const passkeyCount = await mikro.userPasskey.countByUserSub(user.sub);
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
  },
);

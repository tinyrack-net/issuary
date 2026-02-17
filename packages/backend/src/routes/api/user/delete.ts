import type { AppEnv } from '@backend/lib/app-env.js';
import { calculatePermanentDeletionDate } from '@backend/lib/config/index.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { verifyAuth } from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';

/**
 * DELETE /api/user
 *
 * Request account deletion (soft delete).
 */
export const userDelete = new Hono<AppEnv>().delete(
  '/user',
  describeRoute({
    tags: [TAGS.USER],
    summary: 'Delete Account',
    description:
      'Request account deletion. The account will be soft-deleted and ' +
      'permanently removed after the configured retention period.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.AccountDeletionResponse),
          },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.AccountAlreadyDeleted.Schema),
          },
        },
        description: 'Account already deleted',
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
            schema: resolver(e.AccountDeletionDisabled.Schema),
          },
        },
        description: 'Account deletion disabled or user not editable',
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
  verifyAuth(),
  async (c) => {
    const { config, mikro } = c.get('services');
    const session = c.get('session');

    if (!config.app.account_deletion) {
      throw new e.AccountDeletionDisabled.Error();
    }
    const userSession = c.get('verifiedUser');

    if (userSession.managed_by === 'config') {
      throw new e.UserNotEditable.Error();
    }

    const user = await mikro.user.findOneOrFail(
      { id: userSession.id },
      {
        failHandler: () => new e.UserNotFound.Error(),
      },
    );

    if (user.deleted_at !== null) {
      throw new e.AccountAlreadyDeleted.Error();
    }

    user.deleted_at = new Date();
    await mikro.em.flush();

    session.delete();

    const permanentDeletionDate = calculatePermanentDeletionDate(
      user.deleted_at,
      config.cleanup.deleted_users.retention,
    );

    return c.json(
      {
        ok: true,
        deleted_at: user.deleted_at.toISOString(),
        permanent_deletion_at: permanentDeletionDate.toISOString(),
      },
      200,
    );
  },
);

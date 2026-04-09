import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../lib/app-env.ts';
import { calculatePermanentDeletionDate } from '../../../lib/duration.ts';
import { OPENAPI_SECURITY } from '../../../lib/openapi.ts';
import { TAGS } from '../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../middleware/auth.ts';
import { e } from '../../../schemas/error.ts';
import { r } from '../../../schemas/response.ts';

/**
 * DELETE /api/user
 *
 * Request account deletion (soft delete).
 */
export const userDelete = new Hono<AppEnv>().delete(
  '/user',
  describeRoute({
    tags: [TAGS.USER],
    security: OPENAPI_SECURITY.cookieSession,
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
            schema: resolver(
              z.union([
                e.AccountDeletionDisabled.Schema,
                e.UserNotEditable.Schema,
              ]),
            ),
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
    const { config, mikro } = c.var.services;
    const session = c.var.session;

    if (!config.account_deletion.enabled) {
      throw new e.AccountDeletionDisabled.Error();
    }
    const { user: userEntity } = c.var.verifiedUser;

    if (userEntity.managed_by === 'config') {
      throw new e.UserNotEditable.Error();
    }

    if (userEntity.deleted_at !== null) {
      throw new e.AccountAlreadyDeleted.Error();
    }

    userEntity.deleted_at = new Date();
    await mikro.em.flush();

    session.delete();

    const permanentDeletionDate = calculatePermanentDeletionDate(
      userEntity.deleted_at,
      config.account_deletion.retention,
    );

    return c.json(
      {
        ok: true,
        deleted_at: userEntity.deleted_at.toISOString(),
        permanent_deletion_at: permanentDeletionDate.toISOString(),
      },
      200,
    );
  },
);

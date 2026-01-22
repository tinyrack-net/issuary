import z from 'zod/v4';
import { calculatePermanentDeletionDate } from '@/lib/config/index.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * DELETE /api/v1/user
 *
 * Request account deletion (soft delete).
 * The account will be marked for deletion and permanently deleted
 * after the configured retention period.
 */
export default (fastify: FastifyWithZodInstance) => {
  fastify.route({
    method: 'DELETE',
    url: '',
    schema: {
      summary: 'Delete Account',
      description:
        'Request account deletion. The account will be soft-deleted and ' +
        'permanently removed after the configured retention period.',
      tags: [TAGS.USER],
      response: {
        200: r.AccountDeletionResponse,
        400: e.AccountAlreadyDeleted.Schema,
        401: e.Unauthorized.Schema,
        403: z.union([
          e.AccountDeletionDisabled.Schema,
          e.UserNotEditable.Schema,
        ]),
        404: e.UserNotFound.Schema,
      },
    },
    handler: async (req, res) => {
      if (!fastify.config.account_deletion.enabled) {
        throw new e.AccountDeletionDisabled.Error();
      }
      const userSession = await req.auth.verify();

      if (userSession.managed_by === 'config') {
        throw new e.UserNotEditable.Error();
      }

      const user = await fastify.mikro.user.findOneOrFail(
        { id: userSession.id },
        { failHandler: () => new e.UserNotFound.Error() },
      );

      if (user.deleted_at !== null) {
        throw new e.AccountAlreadyDeleted.Error();
      }

      user.deleted_at = new Date();
      await fastify.mikro.em.flush();

      req.session.delete();

      const permanentDeletionDate = calculatePermanentDeletionDate(
        user.deleted_at,
        fastify.config.account_deletion.retention_period,
      );

      return res.status(200).send({
        ok: true,
        deleted_at: user.deleted_at.toISOString(),
        permanent_deletion_at: permanentDeletionDate.toISOString(),
      });
    },
  });
};

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
          e.ConfigManagedAccountCannotBeDeleted.Schema,
        ]),
        404: e.UserNotFound.Schema,
      },
    },
    handler: async (req, res) => {
      // Check if account deletion is enabled
      if (!fastify.config.account_deletion.enabled) {
        throw new e.AccountDeletionDisabled.Error();
      }

      // Verify user is logged in
      const userSession = await req.auth.verify();

      // Config-managed users cannot be deleted
      if (userSession.managed_by === 'config') {
        throw new e.ConfigManagedAccountCannotBeDeleted.Error();
      }

      // Get user and check if already deleted
      const user = await fastify.mikro.user.findOneOrFail(
        { id: userSession.id },
        { failHandler: () => new e.UserNotFound.Error() },
      );

      if (user.deleted_at !== null) {
        throw new e.AccountAlreadyDeleted.Error();
      }

      // Soft delete the user
      user.deleted_at = new Date();
      await fastify.mikro.em.flush();

      // Clear the session
      req.session.delete();

      // Calculate permanent deletion date
      const permanentDeletionDate = calculatePermanentDeletionDate(
        user.deleted_at,
        fastify.config.account_deletion.retention_period,
      );

      return res.status(200).send({
        success: true,
        deleted_at: user.deleted_at.toISOString(),
        permanent_deletion_at: permanentDeletionDate.toISOString(),
      });
    },
  });
};

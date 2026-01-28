import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * DELETE /api/v1/user/password
 *
 * Remove password for users who have at least one OAuth account linked.
 * This allows users to switch to OAuth-only authentication.
 * Requires current password verification for security.
 */
export default (fastify: FastifyWithZodInstance) => {
  fastify.route({
    method: 'DELETE',
    url: '',
    schema: {
      summary: 'Remove Password',
      description:
        'Remove password for users who have at least one OAuth account linked. ' +
        'Requires current password verification and at least one OAuth account.',
      tags: [TAGS.USER],
      body: z.object({
        current_password: f.userPassword,
      }),
      response: {
        200: r.OkResponse,
        400: z.union([
          e.PasswordNotSet.Schema,
          e.CannotRemoveLastAuthMethod.Schema,
          e.CannotRemovePasswordWithSecondFactorOnly.Schema,
        ]),
        401: z.union([e.Unauthorized.Schema, e.InvalidCurrentPassword.Schema]),
        403: e.UserNotEditable.Schema,
        404: e.UserNotFound.Schema,
      },
    },
    handler: async (req, res) => {
      const userSession = await req.auth.verify();

      // Config users cannot remove password
      if (userSession.managed_by === 'config') {
        throw new e.UserNotEditable.Error();
      }

      // Get user with password_hash
      const user = await fastify.mikro.user.findOneOrFail(
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
      const isValid = await user.verifyPassword(req.body.current_password);
      if (!isValid) {
        throw new e.InvalidCurrentPassword.Error();
      }

      // Check if user has at least one OAuth account
      const oauthCount = await fastify.mikro.userOAuth.countByUser(user.id);

      // Check if user has 2FA enabled (TOTP or Passkey)
      const hasTotp = await fastify.mikro.userTotp.isRegistered(user.id);
      const passkeyCount = await fastify.mikro.userPasskey.countByUserId(
        user.id,
      );
      const hasSecondFactor = hasTotp || passkeyCount > 0;

      // Cannot remove password if:
      // 1. No OAuth accounts (CANNOT_REMOVE_LAST_AUTH_METHOD)
      // 2. Has 2FA but no OAuth (CANNOT_REMOVE_PASSWORD_WITH_SECOND_FACTOR_ONLY)
      if (oauthCount === 0) {
        if (hasSecondFactor) {
          throw new e.CannotRemovePasswordWithSecondFactorOnly.Error();
        }
        throw new e.CannotRemoveLastAuthMethod.Error();
      }

      // Remove password
      user.password_hash = null;
      await fastify.mikro.em.flush();

      return res.status(200).send({ ok: true });
    },
  });
};

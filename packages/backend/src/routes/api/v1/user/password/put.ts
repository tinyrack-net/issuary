import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * PUT /api/v1/user/password
 *
 * Change password for users who already have a password set.
 * Requires current password verification before setting the new password.
 */
export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'PUT',
    url: '',
    schema: {
      summary: 'Change Password',
      description:
        'Change password for users who already have a password set. ' +
        'Requires current password verification.',
      tags: [TAGS.USER],
      body: z.object({
        current_password: f.userPassword,
        new_password: f.userPassword,
      }),
      response: {
        200: r.OkResponse,
        400: e.PasswordNotSet.Schema,
        401: z.union([e.Unauthorized.Schema, e.InvalidCurrentPassword.Schema]),
        403: e.UserNotEditable.Schema,
        404: e.UserNotFound.Schema,
      },
    },
    handler: async (req, res) => {
      const userSession = await req.auth.verify();

      // Config users cannot change password
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

      // Set new password
      user.password_hash = req.body.new_password;
      await fastify.mikro.em.flush();

      return res.status(200).send({ ok: true });
    },
  });

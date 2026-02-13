import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * POST /api/v1/user/password
 *
 * Set password for OAuth-only users.
 * This endpoint allows users who signed up via OAuth to add a password
 * for email/password login.
 */
export default (fastify: FastifyWithZodInstance) => {
  fastify.route({
    method: 'POST',
    url: '/user/password',
    schema: {
      summary: 'Set Password',
      description:
        'Set a password for users who signed up via OAuth. ' +
        'Only works if no password is currently set.',
      tags: [TAGS.USER],
      body: z.object({
        password: f.userPassword,
      }),
      response: {
        200: r.OkResponse,
        401: e.Unauthorized.Schema,
        403: e.UserNotEditable.Schema,
        404: e.UserNotFound.Schema,
        409: e.PasswordAlreadySet.Schema,
      },
    },
    handler: async (req, res) => {
      const userSession = await req.auth.verify();

      // Config users cannot set password
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

      // Check if password is already set
      if (user.hasPassword()) {
        throw new e.PasswordAlreadySet.Error();
      }

      // Set new password
      user.password_hash = req.body.password;
      await fastify.mikro.em.flush();

      return res.status(200).send({ ok: true });
    },
  });
};

import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Verify TOTP for login',
      description:
        'Complete login by verifying TOTP code. Requires pending TOTP session from password login.',
      tags: [TAGS.AUTH],
      body: z.object({
        code: f.totpCode,
      }),
      response: {
        200: r.UserSessionResponse,
        400: z.union([e.ValidationError.Schema, e.InvalidTotpCode.Schema]),
        401: e.TotpVerificationSessionExpired.Schema,
      },
    },
    handler: async (req, res) => {
      // Check if there's a pending TOTP user in session
      const pendingTotpUser = req.session.get('pendingTotpUser');
      if (!pendingTotpUser) {
        throw new e.TotpVerificationSessionExpired.Error();
      }

      // Verify TOTP code
      const isValid = await fastify.totpService.verifyForAuth(
        pendingTotpUser.id,
        req.body.code,
      );

      if (!isValid) {
        throw new e.InvalidTotpCode.Error();
      }

      // Get user data for response
      const user = await fastify.userService.verifyUserById(pendingTotpUser.id);

      // Clear pending TOTP session and set full user session
      req.session.set('pendingTotpUser', undefined);
      req.session.set('user', {
        id: user.id,
      });

      return res.status(200).send({
        user,
      });
    },
  });

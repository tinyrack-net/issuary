import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import type { AuthenticationMethod } from '@/plugins/secure-session.js';
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
      const pendingTotpUser = req.session.get('pendingTotpUser');

      if (!pendingTotpUser) {
        throw new e.TotpVerificationSessionExpired.Error();
      }

      await fastify.totpService.verifyForAuth(
        pendingTotpUser.id,
        req.body.code,
      );

      const user = await fastify.userService.verifyUserById(pendingTotpUser.id);
      req.session.set('pendingTotpUser', undefined);

      const authTime =
        pendingTotpUser.authenticated_at ?? Math.floor(Date.now() / 1000);

      const authMethods: AuthenticationMethod[] = [
        ...pendingTotpUser.auth_methods,
        'otp',
        'mfa',
      ];

      req.session.set('user', {
        id: user.id,
        authenticated_at: authTime,
        auth_methods: authMethods,
        acr: 'urn:tinyrack:acr:2',
      });

      return res.status(200).send({
        user,
      });
    },
  });

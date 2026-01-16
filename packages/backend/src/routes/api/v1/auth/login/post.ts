import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.config.basic_authentication_methods.password.enabled) {
    return;
  }
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Login',
      description: 'Login',
      tags: [TAGS.AUTH],
      body: z.object({
        email: f.userEmail,
        password: f.userPassword,
      }),
      response: {
        200: r.LoginResponse,
        400: e.ValidationError.Schema,
        401: e.InvalidEmailOrPassword.Schema,
        403: e.EmailVerificationRequired.Schema,
      },
    },
    handler: async (req, res) => {
      const user = await fastify.userService.verifyUserByEmailAndPassword({
        email: req.body.email,
        password: req.body.password,
      });

      const emailVerificationRequired =
        fastify.userService.userEmailVerificationRequired(user);

      if (emailVerificationRequired && !user.email_verified) {
        return res.status(200).send({
          second_factor_required: false,
          totp_setup_required: false,
          email_verification_required: true,
          email: user.email,
        });
      }

      // Check available 2FA methods
      const available2FAMethods: ('totp' | 'passkey')[] = [];
      if (user.totp_enabled) {
        available2FAMethods.push('totp');
      }
      if (user.passkey_count > 0) {
        available2FAMethods.push('passkey');
      }

      // If 2FA is available, require second factor verification
      if (available2FAMethods.length > 0) {
        req.session.set('pending2FAUser', {
          id: user.id,
          auth_methods: ['pwd'],
          authenticated_at: Math.floor(Date.now() / 1000),
        });
        return res.status(200).send({
          second_factor_required: true,
          available_methods: available2FAMethods,
          totp_setup_required: false,
          email_verification_required: false,
        });
      }

      // TOTP setup required (user must set up TOTP before continuing)
      if (user.totp_required && !user.totp_enabled) {
        req.session.set('pendingTotpSetup', {
          id: user.id,
        });
        return res.status(200).send({
          second_factor_required: false,
          totp_setup_required: true,
          email_verification_required: false,
        });
      }

      // No 2FA required, create full session
      req.session.set('user', {
        id: user.id,
        authenticated_at: Math.floor(Date.now() / 1000),
        auth_methods: ['pwd'],
        acr: 'urn:tinyrack:acr:1',
      });

      return res.status(200).send({
        second_factor_required: false,
        totp_setup_required: false,
        email_verification_required: false,
        user: {
          id: user.id,
          managed_by: user.managed_by,
          email: user.email,
          email_verified: user.email_verified,
          has_password: user.has_password,
          totp_enabled: user.totp_enabled,
          totp_required: false,
          passkey_count: user.passkey_count,
        },
      });
    },
  });
};

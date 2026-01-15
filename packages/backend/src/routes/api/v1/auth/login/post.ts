import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
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

      // Check if email verification is required
      const emailVerificationRequired =
        fastify.userService.userEmailVerificationRequired(user);
      if (emailVerificationRequired && !user.email_verified) {
        return res.status(200).send({
          totp_verification_required: false,
          totp_setup_required: false,
          email_verification_required: true,
          email: user.email,
        });
      }

      if (user.totp_enabled) {
        // Store auth metadata for TOTP flow (will be completed in TOTP verify)
        req.session.set('pendingTotpUser', {
          id: user.id,
          auth_methods: ['pwd'],
          authenticated_at: Math.floor(Date.now() / 1000),
        });
        return res.status(200).send({
          totp_verification_required: true,
          totp_setup_required: false,
          email_verification_required: false,
        });
      }

      const totpRequired = fastify.userService.userTotpRequired(user);

      if (totpRequired) {
        req.session.set('pendingTotpSetup', {
          id: user.id,
        });
        return res.status(200).send({
          totp_verification_required: false,
          totp_setup_required: true,
          email_verification_required: false,
        });
      }

      req.session.set('user', {
        id: user.id,
      });
      // Set authentication metadata for OIDC claims (auth_time, amr, acr)
      req.session.set('authenticated_at', Math.floor(Date.now() / 1000));
      req.session.set('auth_methods', ['pwd']);
      req.session.set('acr', 'urn:tinyrack:acr:1'); // Single factor (password)

      return res.status(200).send({
        totp_verification_required: false,
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

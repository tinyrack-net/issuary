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
      summary: 'Register',
      description: 'Register a new user and send email verification',
      tags: [TAGS.AUTH],
      body: z.object({
        email: f.userEmail,
        password: f.userPassword,
      }),
      response: {
        200: r.UserSessionResponse,
        400: e.ValidationError.Schema,
        403: e.RegistrationDisabled.Schema,
        409: e.EmailAlreadyExists.Schema,
      },
    },
    handler: async (req, res) => {
      // Check if public registration is enabled
      if (!fastify.config.app.public_registration) {
        throw new e.RegistrationDisabled.Error();
      }

      const { user } = await fastify.userService.register({
        email: req.body.email,
        password: req.body.password,
      });

      // Flush user to database before proceeding
      await fastify.mikro.em.flush();

      // If SMTP is configured, send email verification
      if (fastify.transporter) {
        // Generate email verification token
        const verification =
          await fastify.emailVerificationService.generateToken({
            userId: user.id,
          });

        // Flush verification token to database
        await fastify.mikro.em.flush();

        // Send verification email asynchronously (fire-and-forget)
        fastify.emailService.sendVerificationEmailAsync({
          email: user.email,
          token: verification.token,
        });
      } else {
        // No SMTP configured - skip email verification and activate immediately
        user.email_verified = true;
        await fastify.mikro.em.flush();
        req.session.set('user', {
          id: user.id,
        });
      }

      // Check if TOTP or Passkey is required (new users are always database-managed)
      const passwordAuthMethod =
        fastify.config.authentication_methods?.['password'];

      const totpRequired =
        passwordAuthMethod?.type === 'password' &&
        (passwordAuthMethod.totp?.required ?? false);
      const passkeyRequired =
        passwordAuthMethod?.type === 'password' &&
        (passwordAuthMethod.passkey?.required ?? false);

      res.status(200).send({
        user: {
          id: user.id,
          managed: 'database',
          email: user.email,
          email_verified: user.email_verified,
          has_password: true, // Registration always creates password
          totp_enabled: false, // New users don't have TOTP enabled
          totp_required: totpRequired,
          passkey_count: 0, // New users don't have passkeys
          passkey_required: passkeyRequired,
        },
      });
    },
  });

import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';
import z from 'zod/v4';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Register',
      description: 'Register a new user and send email verification',
      tags: ['Auth'],
      body: z.object({
        email: f.userEmail,
        password: f.userPassword,
      }),
      response: {
        200: z.object({
          user: r.UserSession,
        }),
      },
    },
    handler: async (req, res) => {
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
            user: user,
          });

        // Flush verification token to database
        await fastify.mikro.em.flush();

        // Send verification email
        await fastify.emailService.sendVerificationEmail({
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

      res.status(200).send({
        user: {
          id: user.id,
          managed: 'database',
          email: user.email,
          email_verified: user.email_verified,
        },
      });
    },
  });

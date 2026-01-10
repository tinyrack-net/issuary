import z from 'zod/v4';
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
      tags: ['User'],
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

      // Generate email verification token
      const verification = await fastify.emailVerificationService.generateToken(
        {
          user: user,
        },
      );

      // Send verification email
      await fastify.emailService.sendVerificationEmail({
        email: user.email,
        token: verification.token,
      });

      // Do NOT create session until email is verified
      // req.session.set('user', {
      //   id: user.id,
      // });

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

import z from 'zod/v4';
import { UserEntity } from '@/entities/user.entity.js';
import {
  UnauthorizedError,
  validateBearerToken,
} from '@/handlers/validate-bearer-token.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'User Info',
      description:
        'OIDC UserInfo Endpoint - Get information about the authenticated user',
      tags: ['OpenID'],
      headers: z.object({
        authorization: z.string().min(1),
      }),
      response: {
        200: z.object({
          sub: z.string(),
          email: z.string().optional(),
          email_verified: z.boolean().optional(),
          name: z.string().optional(),
          picture: z.string().optional(),
          preferred_username: z.string().optional(),
        }),
        401: z.object({
          error: z.string(),
          error_description: z.string(),
        }),
      },
    },
    handler: async (req, res) => {
      const em = fastify.mikro.orm.em.fork();

      try {
        // Validate Bearer token
        const tokenPayload = await validateBearerToken(req);

        // Load user entity
        const user = await em.findOneOrFail(UserEntity, {
          id: tokenPayload.sub,
        });

        // Parse scopes
        const scopes = tokenPayload.scope.split(' ');

        // Build response based on scopes
        const userInfo: {
          sub: string;
          email?: string;
          email_verified?: boolean;
          name?: string;
          picture?: string;
          preferred_username?: string;
        } = {
          sub: user.id,
        };

        // Add email claims if 'email' scope is present
        if (scopes.includes('email')) {
          userInfo.email = user.email;
          userInfo.email_verified = user.email_verified;
        }

        // Add profile claims if 'profile' scope is present
        if (scopes.includes('profile')) {
          userInfo.name = user.email; // Use email as name for now
          userInfo.preferred_username = user.email;
          // userInfo.picture could be added if user has profile picture
        }

        return res.status(200).send(userInfo);
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          return res.status(401).send({
            error: 'invalid_token',
            error_description: error.message,
          });
        }

        fastify.log.error(error);
        return res.status(401).send({
          error: 'invalid_token',
          error_description: 'An error occurred while validating the token',
        });
      }
    },
  });
};

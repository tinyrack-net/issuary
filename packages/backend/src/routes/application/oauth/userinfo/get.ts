import z from 'zod/v4';
import { validateBearerToken } from '@/handlers/validate-bearer-token.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'User Info',
      description:
        'OIDC UserInfo Endpoint - Returns claims about the authenticated user (RFC OIDC Core §5.3)',
      tags: ['OpenID'],
      headers: z.object({
        authorization: z
          .string()
          .min(1)
          .optional()
          .describe(
            'Bearer token in format: "Bearer <access_token>". The access token must have been issued with openid scope.',
          ),
      }),
      response: {
        200: z.object({
          sub: z
            .string()
            .describe('Subject identifier - unique user ID (always returned)'),
          email: z
            .string()
            .optional()
            .describe('User email address (returned if email scope granted)'),
          email_verified: z
            .boolean()
            .optional()
            .describe(
              'Whether email is verified (returned if email scope granted)',
            ),
          name: z
            .string()
            .optional()
            .describe('User full name (returned if profile scope granted)'),
          picture: z
            .string()
            .optional()
            .describe(
              'User profile picture URL (returned if profile scope granted)',
            ),
          preferred_username: z
            .string()
            .optional()
            .describe('Preferred username (returned if profile scope granted)'),
        }),
        401: z.object({
          code: z.string(),
          message: z.string(),
        }),
        404: z.object({
          code: z.string(),
          message: z.string(),
        }),
      },
    },
    handler: async (req, res) => {
      // Validate Bearer token
      // Throws ApiError if invalid (handled by error handler)
      const tokenPayload = await validateBearerToken(fastify, req);

      // Load user (supports both config and DB users)
      const userData = await fastify.userService.verifyUserById(
        tokenPayload.sub,
      );

      // Parse scopes from token
      const scopes = tokenPayload.scope.split(' ');

      // Build response based on granted scopes (OIDC Core §5.3.2)
      const userInfo: {
        sub: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
        picture?: string;
        preferred_username?: string;
      } = {
        sub: userData.id,
      };

      // Add email claims if 'email' scope is present
      if (scopes.includes('email')) {
        userInfo.email = userData.email;
        userInfo.email_verified = userData.email_verified;
      }

      // Add profile claims if 'profile' scope is present
      if (scopes.includes('profile')) {
        userInfo.name = userData.email; // Use email as name for now
        userInfo.preferred_username = userData.email;
        // userInfo.picture could be added when user profile pictures are implemented
      }

      return res.status(200).send(userInfo);
    },
  });
};

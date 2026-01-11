import z from 'zod/v4';
import { e } from '@/schemas/error.js';
import { h } from '@/schemas/header.js';
import { r } from '@/schemas/response.js';
import { TAGS } from '@/lib/swagger-tags.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'User Info',
      description:
        'OIDC UserInfo Endpoint - Returns claims about the authenticated user (RFC OIDC Core §5.3)',
      tags: [TAGS.OPENID],
      headers: h.BearerAuth,
      response: {
        200: r.UserInfoResponse,
        401: z.union([
          e.MissingAuthorizationHeader.Schema,
          e.InvalidAuthorizationHeaderFormat.Schema,
          e.MissingBearerToken.Schema,
          e.InvalidAccessToken.Schema,
        ]),
        404: e.UserNotFound.Schema,
      },
    },
    handler: async (req, res) => {
      // Validate Bearer token
      // Throws ApiError if invalid (handled by error handler)
      const tokenPayload = await fastify.jwtService.validateBearerToken(req);

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

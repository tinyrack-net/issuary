import { createRouter } from '@backend/lib/create-router.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { h } from '@backend/schemas/header.js';
import { r } from '@backend/schemas/response.js';
import { createRoute, type z } from '@hono/zod-openapi';

type UserInfoResponse = z.infer<typeof r.UserInfoResponse>;

const route = createRoute({
  method: 'get',
  path: '/userinfo',
  tags: [TAGS.OPENID],
  summary: 'User Info',
  description:
    'OIDC UserInfo Endpoint - Returns claims about the authenticated user (RFC OIDC Core §5.3)',
  request: {
    headers: h.BearerAuth,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: r.UserInfoResponse,
        },
      },
      description: 'Success',
    },
    401: {
      content: {
        'application/json': {
          schema: e.MissingAuthorizationHeader.Schema,
        },
      },
      description: 'Missing or invalid authorization header',
    },
    404: {
      content: {
        'application/json': {
          schema: e.UserNotFound.Schema,
        },
      },
      description: 'User not found',
    },
  },
});

export default createRouter().openapi(route, async (c) => {
  const { jwtService, mikro, userService } = c.get('services');

  // Validate Bearer token
  const authorization = c.req.header('authorization');
  const tokenPayload = await jwtService.validateBearerToken({
    headers: authorization ? { authorization } : {},
  });

  // Load user
  const userEntity = await mikro.user.verifyById(tokenPayload.sub);
  const userData = await userService.userEntityToSessionUser(userEntity);

  // Parse scopes from token
  const scopes = tokenPayload.scope.split(' ');

  // Build response based on granted scopes
  const userInfo: UserInfoResponse = {
    sub: userData.id,
  };

  if (scopes.includes('email')) {
    userInfo.email = userData.email;
    userInfo.email_verified = userData.email_verified;
  }

  if (scopes.includes('profile')) {
    userInfo.name = userData.email;
    userInfo.preferred_username = userData.email;
  }

  return c.json(userInfo, 200);
});

import { type Context, Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import type { z } from 'zod';
import type { AppEnv } from '../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../lib/openapi.ts';
import { TAGS } from '../../../lib/swagger-tags.ts';
import { e } from '../../../schemas/error.ts';
import { h } from '../../../schemas/header.ts';
import { r } from '../../../schemas/response.ts';

type UserInfoResponse = z.infer<typeof r.UserInfoResponse>;

const userinfoHandler = async (c: Context<AppEnv>) => {
  const { jwtService, mikro, userService } = c.var.services;

  // Validate Bearer token
  const authorization = c.req.header('authorization');
  const tokenPayload = await jwtService.validateBearerToken({
    headers: authorization ? { authorization } : {},
  });

  // Load user
  const userEntity = await mikro.user.verifyBySub(tokenPayload.sub);
  const userData = await userService.userEntityToSessionUser(userEntity);

  // Parse scopes from token
  const scopes = tokenPayload.scope.split(' ');

  if (!scopes.includes('openid')) {
    throw new e.InsufficientScope.Error();
  }

  // Build response based on granted scopes
  const userInfo: UserInfoResponse = {
    sub: userData.sub,
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
};

export const userinfoGet = new Hono<AppEnv>()
  .get(
    '/userinfo',
    describeRoute({
      tags: [TAGS.OPENID],
      security: OPENAPI_SECURITY.bearer,
      summary: 'User Info',
      description:
        'OIDC UserInfo Endpoint - Returns claims about the authenticated user (RFC OIDC Core §5.3)',
      responses: {
        200: {
          content: {
            'application/json': {
              schema: resolver(r.UserInfoResponse),
            },
          },
          description: 'Success',
        },
        401: {
          content: {
            'application/json': {
              schema: resolver(e.MissingAuthorizationHeader.Schema),
            },
          },
          description: 'Missing or invalid authorization header',
        },
        404: {
          content: {
            'application/json': {
              schema: resolver(e.UserNotFound.Schema),
            },
          },
          description: 'User not found',
        },
      },
    }),
    validator('header', h.BearerAuth),
    userinfoHandler,
  )
  .post(
    '/userinfo',
    describeRoute({
      tags: [TAGS.OPENID],
      security: OPENAPI_SECURITY.bearer,
      summary: 'User Info',
      description: 'OIDC UserInfo Endpoint POST method',
      responses: {
        200: {
          content: {
            'application/json': {
              schema: resolver(r.UserInfoResponse),
            },
          },
          description: 'Success',
        },
      },
    }),
    validator('header', h.BearerAuth),
    userinfoHandler,
  );

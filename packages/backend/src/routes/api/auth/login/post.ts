import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

export const authLoginPost = new Hono<AppEnv>().post(
  '/auth/login',
  describeRoute({
    tags: [TAGS.AUTH],
    summary: 'Login',
    description: 'Login',
    responses: {
      200: {
        content: {
          'application/json': { schema: resolver(r.AuthResponse) },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.ValidationError.Schema),
          },
        },
        description: 'Validation error',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.InvalidEmailOrPassword.Schema),
          },
        },
        description: 'Invalid email or password',
      },
      403: {
        content: {
          'application/json': {
            schema: resolver(e.EmailVerificationRequired.Schema),
          },
        },
        description: 'Email verification required',
      },
    },
  }),
  validator(
    'json',
    z.object({
      email: f.userEmail,
      password: f.userPassword,
    }),
  ),
  async (c) => {
    const config = c.get('services').config;
    if (!config.auth.password.enabled) {
      throw new e.ValidationError.Error('Password authentication is disabled');
    }

    const body = c.req.valid('json');
    const { mikro, userService } = c.get('services');
    const session = c.get('session');

    const userEntity = await mikro.user.verifyByEmailAndPassword({
      email: body.email,
      password: body.password,
    });

    if (!(await userEntity.verifyPassword(body.password))) {
      throw new e.InvalidEmailOrPassword.Error();
    }

    const userSession = await userService.userEntityToSessionUser(userEntity);

    if (
      userService.userEmailVerificationRequired(userSession) &&
      !userSession.email_verified
    ) {
      return c.json({ user: userSession }, 200);
    }

    const userRegistered2FAMethods = await userService.userRegistered2FAMethods(
      userSession.id,
    );

    if (userRegistered2FAMethods.length > 0) {
      session.setPending2FASession(userSession.id);
    } else if (userSession.second_factor_required) {
      session.setPending2FASetupSession(userSession.id);
    } else {
      session.setUserSession(userSession.id);
    }

    return c.json({ user: userSession }, 200);
  },
);

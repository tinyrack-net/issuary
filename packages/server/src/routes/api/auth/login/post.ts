import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { TAGS } from '../../../../lib/swagger-tags.ts';
import { e } from '../../../../schemas/error.ts';
import { f } from '../../../../schemas/field.ts';
import { r } from '../../../../schemas/response.ts';

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
    const body = c.req.valid('json');
    const { services, session } = c.var;
    const config = services.config;
    if (!config.auth.password.enabled) {
      throw new e.ValidationError.Error('Password authentication is disabled');
    }

    const userEntity =
      await services.passwordAuthService.authenticateByEmailAndPassword({
        email: body.email,
        password: body.password,
      });
    const user = await services.userService.userEntityToSessionUser(userEntity);

    if (
      services.userService.userEmailVerificationRequired(user) &&
      !user.email_verified
    ) {
      return c.json({ user }, 200);
    }

    const registered2FAMethods =
      await services.userService.userRegistered2FAMethods(user.sub);
    if (registered2FAMethods.length > 0) {
      session.setPending2FASession(user.sub);
    } else if (user.second_factor_required) {
      session.setPending2FASetupSession(user.sub);
    } else {
      session.setUserSession(user.sub);
    }

    return c.json({ user }, 200);
  },
);

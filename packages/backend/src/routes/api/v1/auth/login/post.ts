import { createRoute } from '@hono/zod-openapi';
import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { AppType } from '@/types.js';

const route = createRoute({
  method: 'post',
  path: '/auth/login',
  tags: [TAGS.AUTH],
  summary: 'Login',
  description: 'Login',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: f.userEmail,
            password: f.userPassword,
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: r.AuthResponse },
      },
      description: 'Success',
    },
    400: {
      content: {
        'application/json': {
          schema: e.ValidationError.Schema,
        },
      },
      description: 'Validation error',
    },
    401: {
      content: {
        'application/json': {
          schema: e.InvalidEmailOrPassword.Schema,
        },
      },
      description: 'Invalid email or password',
    },
    403: {
      content: {
        'application/json': {
          schema: e.EmailVerificationRequired.Schema,
        },
      },
      description: 'Email verification required',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
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
  });
};

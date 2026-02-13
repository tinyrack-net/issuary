import { createRoute, z } from '@hono/zod-openapi';
import type { AppType } from '@/lib/app.js';
import { isEmailAllowed } from '@/lib/email-pattern.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import { termsSchema } from '@/schemas/terms.js';

const route = createRoute({
  method: 'post',
  path: '/auth/register',
  tags: [TAGS.AUTH],
  summary: 'Register',
  description:
    'Register a new user with terms consent and send email verification',
  request: {
    headers: z.object({
      'accept-language': f.acceptLanguage,
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: f.userEmail,
            password: f.userPassword,
            consents: z
              .array(termsSchema.ConsentItem)
              .optional()
              .describe('Terms consent decisions'),
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
    403: {
      content: {
        'application/json': {
          schema: e.RegistrationDisabled.Schema,
        },
      },
      description: 'Registration disabled or email not allowed',
    },
    409: {
      content: {
        'application/json': {
          schema: e.EmailAlreadyExists.Schema,
        },
      },
      description: 'Email already exists',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    const body = c.req.valid('json');
    const headers = c.req.valid('header');
    const { email, password, consents } = body;
    const { config, userService } = c.get('services');
    const session = c.get('session');
    const { allowed_signup_emails } = config.app;

    // Check if signup is disabled entirely
    if (allowed_signup_emails.length === 0) {
      throw new e.RegistrationDisabled.Error();
    }

    // Check if the email matches allowed patterns
    if (!isEmailAllowed(email, allowed_signup_emails)) {
      throw new e.RegistrationEmailNotAllowed.Error();
    }

    // Register the user (terms consent validation and recording handled inside)
    const userSession = await userService.register({
      email,
      password,
      locale: headers['accept-language'],
      ...(consents && { consents }),
    });

    if (userSession.email_verification_required) {
      return c.json({ user: userSession }, 200);
    }

    if (userSession.second_factor_required) {
      session.setPending2FASetupSession(userSession.id);
    } else {
      session.setUserSession(userSession.id);
    }

    return c.json({ user: userSession }, 200);
  });
};

import type { AppEnv } from '@backend/lib/app-env.js';
import { isEmailAllowed } from '@backend/lib/email-pattern.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { termsSchema } from '@backend/schemas/terms.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

export const authRegisterPost = new Hono<AppEnv>().post(
  '/auth/register',
  describeRoute({
    tags: [TAGS.AUTH],
    summary: 'Register',
    description:
      'Register a new user with terms consent and send email verification',
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
      403: {
        content: {
          'application/json': {
            schema: resolver(e.RegistrationDisabled.Schema),
          },
        },
        description: 'Registration disabled or email not allowed',
      },
      409: {
        content: {
          'application/json': {
            schema: resolver(e.EmailAlreadyExists.Schema),
          },
        },
        description: 'Email already exists',
      },
    },
  }),
  validator(
    'header',
    z.object({
      'accept-language': f.acceptLanguage,
    }),
  ),
  validator(
    'json',
    z.object({
      email: f.userEmail,
      password: f.userPassword,
      consents: z
        .array(termsSchema.ConsentItem)
        .optional()
        .describe('Terms consent decisions'),
    }),
  ),
  async (c) => {
    const body = c.req.valid('json');
    const headers = c.req.valid('header');
    const { email, password, consents } = body;
    const { config, userService } = c.var.services;
    const session = c.var.session;

    if (!config.auth.password.enabled) {
      throw new e.ValidationError.Error('Password authentication is disabled');
    }

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
      session.setPending2FASetupSession(userSession.sub);
    } else {
      session.setUserSession(userSession.sub);
    }

    return c.json({ user: userSession }, 200);
  },
);

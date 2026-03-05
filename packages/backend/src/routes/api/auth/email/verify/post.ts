import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '#backend/lib/app-env.js';
import { TAGS } from '#backend/lib/swagger-tags.js';
import { e } from '#backend/schemas/error.js';
import { f } from '#backend/schemas/field.js';
import { r } from '#backend/schemas/response.js';

export const authEmailVerifyPost = new Hono<AppEnv>().post(
  '/auth/email/verify',
  describeRoute({
    tags: [TAGS.AUTH],
    summary: 'Verify Email',
    description: 'Verify user email with verification token',
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
            schema: resolver(e.InvalidVerificationToken.Schema),
          },
        },
        description: 'Invalid verification token',
      },
      403: {
        content: {
          'application/json': {
            schema: resolver(e.EmailNotActivated.Schema),
          },
        },
        description: 'Email service not activated',
      },
    },
  }),
  validator(
    'json',
    z.object({
      token: f.token,
    }),
  ),
  async (c) => {
    const services = c.var.services;
    const session = c.var.session;
    const body = c.req.valid('json');

    const user = await services.emailService.verifyEmail(body.token);
    const userSession = await services.userService.getSessionUserBySub(
      user.sub,
    );
    const available2FAMethods =
      services.userService.getAvailable2FASetupMethods();

    if (
      userSession.second_factor_required &&
      !userSession.totp_registered &&
      userSession.passkey_count === 0 &&
      available2FAMethods.length > 0
    ) {
      session.setPending2FASetupSession(user.sub);
      return c.json({ user: userSession }, 200);
    }

    session.setUserSession(user.sub);
    return c.json({ user: userSession }, 200);
  },
);

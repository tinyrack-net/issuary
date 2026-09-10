import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../../lib/app-env.ts';
import { TAGS } from '../../../../../lib/swagger-tags.ts';
import { e } from '../../../../../schemas/error.ts';
import { f } from '../../../../../schemas/field.ts';
import { r } from '../../../../../schemas/response.ts';
import { withUserSecurity } from '../../../../../services/user-security.service.js';

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
        description:
          'Invalid, expired, used, or revoked verification token. Request a new email.',
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

    if (!services.config.email) throw new e.EmailNotActivated.Error();
    const candidate = await services.mikro.emailVerification.findOne({
      token: body.token,
      verified: false,
      expiresAt: { $gt: new Date() },
    });
    if (!candidate) throw new e.InvalidVerificationToken.Error();
    return session.atomic(() =>
      withUserSecurity(
        services.mikro,
        candidate.user.sub,
        async () => {
          const user = await services.emailService.verifyEmail(body.token);
          const userSession = await services.userService.getSessionUserBySub(
            user.sub,
          );
          const registeredMethods =
            await services.userService.userRegistered2FAMethods(user.sub);
          if (registeredMethods.length > 0) {
            session.setPending2FASession(user.sub, user.token_epoch);
            return c.json({ user: userSession }, 200);
          }
          const available2FAMethods =
            services.userService.getAvailable2FASetupMethods();

          if (
            userSession.second_factor_required &&
            !userSession.totp_registered &&
            userSession.passkey_count === 0 &&
            available2FAMethods.length > 0
          ) {
            session.setPending2FASetupSession(user.sub, user.token_epoch);
            return c.json({ user: userSession }, 200);
          }

          session.setUserSession(user.sub, user.token_epoch);
          return c.json({ user: userSession }, 200);
        },
        { includeDeleted: true },
      ),
    );
  },
);

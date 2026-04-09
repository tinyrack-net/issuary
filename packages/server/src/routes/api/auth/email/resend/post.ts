import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../../lib/app-env.ts';
import { TAGS } from '../../../../../lib/swagger-tags.ts';
import { e } from '../../../../../schemas/error.ts';
import { f } from '../../../../../schemas/field.ts';
import { r } from '../../../../../schemas/response.ts';

export const authEmailResendPost = new Hono<AppEnv>().post(
  '/auth/email/resend',
  describeRoute({
    tags: [TAGS.AUTH],
    summary: 'Resend Verification Email',
    description: 'Resend email verification link to user',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.MessageResponse),
          },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.EmailAlreadyVerified.Schema),
          },
        },
        description: 'Email already verified',
      },
      404: {
        content: {
          'application/json': {
            schema: resolver(e.UserNotFound.Schema),
          },
        },
        description: 'User not found',
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
    'header',
    z.object({
      'accept-language': f.acceptLanguage,
    }),
  ),
  validator(
    'json',
    z.object({
      email: f.userEmail,
    }),
  ),
  async (c) => {
    const services = c.var.services;
    const body = c.req.valid('json');
    const headers = c.req.valid('header');

    const verification = await services.emailService.resendVerification(
      body.email,
    );

    services.emailService.sendVerificationEmailAsync({
      email: body.email,
      token: verification.token,
      locale: headers['accept-language'],
    });

    return c.json(
      {
        message: 'Verification email has been resent. Please check your inbox.',
      },
      200,
    );
  },
);

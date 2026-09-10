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
    description:
      'Request verification email. The response does not reveal whether the address exists or is already verified.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.MessageResponse),
          },
        },
        description: 'Success',
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

    await services.mailQueue.enqueue(
      'verification',
      body.email,
      headers['accept-language'],
    );

    return c.json(
      {
        message: 'If this address needs verification, an email will be sent.',
      },
      200,
    );
  },
);

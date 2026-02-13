import { createRoute } from '@hono/zod-openapi';
import z from 'zod';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { AppType } from '@/types.js';

const route = createRoute({
  method: 'post',
  path: '/auth/email/resend',
  tags: [TAGS.AUTH],
  summary: 'Resend Verification Email',
  description: 'Resend email verification link to user',
  request: {
    headers: z.object({
      'accept-language': f.acceptLanguage,
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: f.userEmail,
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: r.MessageResponse,
        },
      },
      description: 'Success',
    },
    400: {
      content: {
        'application/json': {
          schema: e.EmailAlreadyVerified.Schema,
        },
      },
      description: 'Email already verified',
    },
    404: {
      content: {
        'application/json': {
          schema: e.UserNotFound.Schema,
        },
      },
      description: 'User not found',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    const services = c.get('services');

    if (!services.emailVerificationService) {
      throw new e.EmailNotActivated.Error();
    }

    const body = c.req.valid('json');
    const headers = c.req.valid('header');

    const verification =
      await services.emailVerificationService.resendVerification(body.email);

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
  });
};

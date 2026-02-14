import { createRouter } from '@backend/lib/create-router.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { createRoute, z } from '@hono/zod-openapi';

const route = createRoute({
  method: 'post',
  path: '/auth/password/forgot',
  tags: [TAGS.AUTH],
  summary: 'Request password reset',
  description:
    'Sends a password reset email to the user. Always returns success to prevent email enumeration.',
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
        'application/json': { schema: r.OkResponse },
      },
      description: 'Success',
    },
    403: {
      content: {
        'application/json': {
          schema: e.UserNotEditable.Schema,
        },
      },
      description: 'User not editable',
    },
  },
});

export const authPasswordForgotPost = createRouter().openapi(
  route,
  async (c) => {
    const services = c.get('services');

    // Only enable if email service is available
    if (!services.mail) {
      return c.json({ ok: true as const }, 200);
    }

    const body = c.req.valid('json');
    const headers = c.req.valid('header');
    const { email } = body;

    try {
      const resetEntity =
        await services.passwordResetService.requestPasswordReset(email);

      if (resetEntity) {
        services.emailService.sendPasswordResetEmailAsync({
          email,
          token: resetEntity.token,
          locale: headers['accept-language'],
        });
      }

      return c.json({ ok: true as const }, 200);
    } catch (error) {
      // Always return success to prevent email enumeration
      if (
        error instanceof e.UserNotEditable.Error ||
        error instanceof e.UserNotFound.Error
      ) {
        return c.json({ ok: true as const }, 200);
      }
      throw error;
    }
  },
);

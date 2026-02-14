import { createRoute, z } from '@hono/zod-openapi';
import { createRouter } from '@/lib/create-router.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';

const route = createRoute({
  method: 'post',
  path: '/auth/password/reset',
  tags: [TAGS.AUTH],
  summary: 'Reset password',
  description: 'Resets the user password using a valid reset token.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            token: f.token,
            password: f.userPassword,
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
          schema: e.InvalidPasswordResetToken.Schema,
        },
      },
      description: 'Invalid password reset token',
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

export default createRouter().openapi(route, async (c) => {
  const services = c.get('services');

  if (!services.mail) {
    throw new e.ValidationError.Error('Email service is not available');
  }

  const body = c.req.valid('json');
  const { token, password } = body;

  await services.passwordResetService.resetPassword({
    token,
    password,
  });

  return c.json(
    {
      message: 'Password has been reset successfully.',
    },
    200,
  );
});

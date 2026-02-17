import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

export const authPasswordResetPost = new Hono<AppEnv>().post(
  '/auth/password/reset',
  describeRoute({
    tags: [TAGS.AUTH],
    summary: 'Reset password',
    description: 'Resets the user password using a valid reset token.',
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
            schema: resolver(e.InvalidPasswordResetToken.Schema),
          },
        },
        description: 'Invalid password reset token',
      },
      403: {
        content: {
          'application/json': {
            schema: resolver(e.UserNotEditable.Schema),
          },
        },
        description: 'User not editable',
      },
    },
  }),
  validator(
    'json',
    z.object({
      token: f.token,
      password: f.userPassword,
    }),
  ),
  async (c) => {
    const services = c.var.services;

    if (!services.config.smtp) {
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
  },
);

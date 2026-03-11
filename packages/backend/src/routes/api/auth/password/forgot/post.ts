import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '#backend/lib/app-env.js';
import { TAGS } from '#backend/lib/swagger-tags.js';
import { e } from '#backend/schemas/error.js';
import { f } from '#backend/schemas/field.js';
import { r } from '#backend/schemas/response.js';

export const authPasswordForgotPost = new Hono<AppEnv>().post(
  '/auth/password/forgot',
  describeRoute({
    tags: [TAGS.AUTH],
    summary: 'Request password reset',
    description:
      'Sends a password reset email to the user. Always returns success to prevent email enumeration.',
    responses: {
      200: {
        content: {
          'application/json': { schema: resolver(r.OkResponse) },
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

    if (!services.config.auth.password.enabled) {
      throw new e.ValidationError.Error('Password authentication is disabled');
    }

    // Only enable if email service is available
    if (!services.config.email) {
      throw new e.EmailNotActivated.Error();
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

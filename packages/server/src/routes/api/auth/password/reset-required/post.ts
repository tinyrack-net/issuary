import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../../lib/app-env.ts';
import { TAGS } from '../../../../../lib/swagger-tags.ts';
import { verifyPasswordResetUser } from '../../../../../middleware/auth.ts';
import { e } from '../../../../../schemas/error.ts';
import { f } from '../../../../../schemas/field.ts';
import { r } from '../../../../../schemas/response.ts';

export const authPasswordResetRequiredPost = new Hono<AppEnv>().post(
  '/auth/password/reset-required',
  describeRoute({
    tags: [TAGS.AUTH],
    summary: 'Set a replacement password',
    description:
      'Sets a new password after passkey verification retired a legacy password. Does not create a user session.',
    responses: {
      200: {
        content: {
          'application/json': { schema: resolver(r.MessageResponse) },
        },
        description: 'Password replaced; a fresh login is required',
      },
      400: {
        content: {
          'application/json': { schema: resolver(e.ValidationError.Schema) },
        },
        description: 'Password policy validation failed',
      },
      401: {
        content: {
          'application/json': { schema: resolver(e.Unauthorized.Schema) },
        },
        description: 'Restricted password-reset session required',
      },
    },
  }),
  validator('json', z.object({ password: f.newUserPassword })),
  verifyPasswordResetUser(),
  async (c) => {
    const user = c.var.verifiedPasswordResetUser;
    await c.var.services.passwordAuthService.replacePassword(
      user,
      c.req.valid('json').password,
    );
    c.var.session.delete();
    return c.json(
      { message: 'Password has been set. Sign in with the new password.' },
      200,
    );
  },
);

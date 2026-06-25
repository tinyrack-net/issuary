import { Hono } from 'hono';
import { describeRoute, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { TAGS } from '../../../../lib/swagger-tags.ts';

export const authAccountsRemovePost = new Hono<AppEnv>().post(
  '/auth/accounts/remove',
  describeRoute({
    tags: [TAGS.AUTH],
    summary: 'Remove remembered account',
    description:
      'Removes a non-active remembered account from this browser session.',
    responses: {
      200: { description: 'Success' },
      400: { description: 'The account is active or not remembered.' },
    },
  }),
  validator('json', z.object({ sub: z.string().min(1) })),
  async (c) => {
    if (!c.var.services.config.auth.account_selection.allow_remove_account) {
      return c.json(
        {
          code: 'ACCOUNT_REMOVAL_DISABLED',
          message: 'Removing remembered accounts is disabled.',
        },
        400,
      );
    }

    const { sub } = c.req.valid('json');
    const removed = c.var.session.removeRememberedUserSession(sub);
    if (!removed) {
      return c.json(
        {
          code: 'ACCOUNT_NOT_REMOVABLE',
          message: 'The requested account is active or not remembered.',
        },
        400,
      );
    }
    return c.json({ ok: true as const }, 200);
  },
);

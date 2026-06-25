import { Hono } from 'hono';
import { describeRoute, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { TAGS } from '../../../../lib/swagger-tags.ts';

export const authAccountsSelectPost = new Hono<AppEnv>().post(
  '/auth/accounts/select',
  describeRoute({
    tags: [TAGS.AUTH],
    summary: 'Select remembered account',
    description: 'Promotes a remembered account to the active session user.',
    responses: {
      200: { description: 'Success' },
      400: {
        description: 'The account is not remembered in this browser session.',
      },
    },
  }),
  validator('json', z.object({ sub: z.string().min(1) })),
  async (c) => {
    const { sub } = c.req.valid('json');
    const selected = c.var.session.selectUserSession(sub);
    if (!selected) {
      return c.json(
        {
          code: 'ACCOUNT_NOT_REMEMBERED',
          message: 'The requested account is not remembered in this session.',
        },
        400,
      );
    }
    return c.json({ ok: true as const, active_sub: sub }, 200);
  },
);

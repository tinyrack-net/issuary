import { Hono } from 'hono';
import { describeRoute, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { TAGS } from '../../../../lib/swagger-tags.ts';

export const authAccountsGet = new Hono<AppEnv>().get(
  '/auth/accounts',
  describeRoute({
    tags: [TAGS.AUTH],
    summary: 'List remembered accounts',
    description:
      'Lists browser-session remembered accounts available for OIDC account selection.',
    responses: {
      200: { description: 'Success' },
    },
  }),
  validator('query', z.object({ client_id: z.string().optional() })),
  async (c) => {
    const { config, mikro } = c.var.services;
    const { client_id } = c.req.valid('query');
    const clientAccountSelection = client_id
      ? config.clients.find((client) => client.client_id === client_id)
          ?.account_selection
      : undefined;
    const activeSub = c.var.session.get('user')?.sub ?? null;
    const rememberedAccounts = c.var.session.get('accounts') ?? [];
    const accounts = [];

    for (const account of rememberedAccounts) {
      const user = await mikro.user.findOne({
        sub: account.sub,
        deleted_at: null,
      });
      if (!user) {
        continue;
      }
      accounts.push({
        sub: user.sub,
        email: user.email,
        role: user.role,
        current: user.sub === activeSub,
        authenticated_at: account.authenticated_at,
        last_used_at: account.last_used_at,
      });
    }

    return c.json(
      {
        active_sub: activeSub,
        accounts,
        allow_add_account:
          clientAccountSelection?.allow_add_account ??
          config.auth.account_selection.allow_add_account,
        allow_remove_account:
          config.auth.account_selection.allow_remove_account,
      },
      200,
    );
  },
);

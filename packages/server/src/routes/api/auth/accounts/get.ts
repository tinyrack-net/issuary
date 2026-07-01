import { Hono } from 'hono';
import { describeRoute, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../lib/app-env.js';
import { TAGS } from '../../../../lib/swagger-tags.js';
import { normalizeAccountSelectionPolicy } from '../../../../services/account-selection.service.js';

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
    const accountSelectionPolicy = normalizeAccountSelectionPolicy(
      config,
      client_id,
    );
    const activeSub = c.var.session.get('user')?.sub ?? null;
    const rememberedAccounts = c.var.session.get('accounts') ?? [];
    const rememberedSubs = rememberedAccounts.map((account) => account.sub);
    const users =
      rememberedSubs.length === 0
        ? []
        : await mikro.user.find({
            sub: { $in: rememberedSubs },
            deleted_at: null,
          });
    const userBySub = new Map(users.map((user) => [user.sub, user]));
    const accounts = [];

    for (const account of rememberedAccounts) {
      const user = userBySub.get(account.sub);
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
        allow_add_account: accountSelectionPolicy.allowAddAccount,
        allow_remove_account: accountSelectionPolicy.allowRemoveAccount,
      },
      200,
    );
  },
);

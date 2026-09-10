import { defineEntity } from '@mikro-orm/core';

export const AuthBudgetEntitySchema = defineEntity({
  name: 'AuthBudgetEntity',
  tableName: 'auth_budget',
  properties: (p) => ({
    id: p.string().primary(),
    attempts: p.integer(),
    expires_at: p.datetime().index(),
  }),
});

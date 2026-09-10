import { defineEntity, type InferEntity } from '@mikro-orm/core';
import type { SessionData } from '../middleware/session.js';

export const BrowserSessionEntitySchema = defineEntity({
  name: 'BrowserSessionEntity',
  tableName: 'browser_session',
  properties: (p) => ({
    id: p.string().primary(),
    data: p.json<SessionData>(),
    revision: p.integer().default(0),
    expires_at: p.datetime().index(),
  }),
});
export type BrowserSessionEntity = InferEntity<
  typeof BrowserSessionEntitySchema
>;

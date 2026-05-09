import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { BaseSchema } from './base.entity.ts';

export const BootstrapStateEntitySchema = defineEntity({
  name: 'BootstrapStateEntity',
  tableName: 'bootstrap_state',
  comment: 'Runtime bootstrap metadata',
  extends: BaseSchema,
  properties: (p) => ({
    id: p.string().primary().comment('Bootstrap metadata key'),
    value: p.string().comment('Bootstrap metadata value'),
  }),
});

export type IBootstrapStateEntity = InferEntity<
  typeof BootstrapStateEntitySchema
>;

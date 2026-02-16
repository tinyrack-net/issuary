import { defineEntity } from '@mikro-orm/core';

const p = defineEntity.properties;

export const BaseProperties = {
  created_at: p
    .datetime()
    .comment('Timestamp when the entity was created')
    .onCreate(() => new Date()),
  updated_at: p
    .datetime()
    .comment('Timestamp when the entity was last updated')
    .onCreate(() => new Date())
    .onUpdate(() => new Date()),
};

export const BaseSchema = defineEntity({
  name: 'Base',
  abstract: true,
  properties: (_p) => ({
    ...BaseProperties,
  }),
});

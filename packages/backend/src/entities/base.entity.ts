import { type Opt, PrimaryKeyProp, t } from '@mikro-orm/core';
import { Entity, Property } from '@mikro-orm/decorators/legacy';

@Entity({ abstract: true })
export abstract class BaseEntity<PK extends string = 'id'> {
  [PrimaryKeyProp]?: PK;

  @Property({
    type: t.datetime,
    name: 'created_at',
    comment: 'Timestamp when the entity was created',
    nullable: false,
  })
  public created_at: Opt<Date> = new Date();

  @Property({
    type: t.datetime,
    name: 'updated_at',
    comment: 'Timestamp when the entity was last updated',
    nullable: false,
    onUpdate: () => new Date(),
  })
  public updated_at: Opt<Date> = new Date();
}

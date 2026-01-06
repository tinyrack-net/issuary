import { Entity, type Opt, Property, t } from '@mikro-orm/core';

@Entity({ abstract: true })
export abstract class BaseEntity {
  @Property({
    type: t.datetime,
    name: 'created_at',
    comment: 'Timestamp when the user was created',
    nullable: false,
  })
  public created_at: Opt<Date> = new Date();

  @Property({
    type: t.datetime,
    name: 'updated_at',
    comment: 'Timestamp when the user was last updated',
    nullable: false,
    onUpdate: () => new Date(),
  })
  public updated_at: Opt<Date> = new Date();
}

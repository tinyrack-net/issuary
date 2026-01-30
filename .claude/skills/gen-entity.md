# gen-entity

Generate a new MikroORM entity with repository and test file.

## Usage

```
/gen-entity <name>
```

## Arguments

- `<name>`: Entity name in PascalCase (e.g., `AuditLog`, `UserPreference`)

## Instructions

When the user invokes this skill:

1. Parse the entity name
2. Convert to appropriate formats:
   - Class name: `<Name>Entity` (e.g., `AuditLogEntity`)
   - Table name: snake_case (e.g., `audit_log`)
   - File name: kebab-case (e.g., `audit-log.entity.ts`)
   - Repository: `<Name>Repository` (e.g., `AuditLogRepository`)
3. Create files:
   - `packages/backend/src/entities/<name>.entity.ts`
   - `packages/backend/src/repositories/<name>.repository.ts`
   - `packages/backend/src/entities/<name>.entity.test.ts`

### Entity File Template

```typescript
import {
  Entity,
  EntityRepositoryType,
  type Opt,
  PrimaryKey,
  Property,
  t,
} from '@mikro-orm/core';
import { <Name>Repository } from '@/repositories/<name>.repository.js';
import { BaseEntity } from './base.entity.js';

@Entity({
  tableName: '<table_name>',
  comment: 'TODO: Add table description',
  repository: () => <Name>Repository,
})
export class <Name>Entity extends BaseEntity {
  [EntityRepositoryType]?: <Name>Repository;

  @PrimaryKey({
    type: t.uuid,
    name: 'id',
    comment: 'Primary key as UUID',
    nullable: false,
  })
  public id: string = crypto.randomUUID();

  // TODO: Add entity properties
  // Example:
  // @Property({
  //   type: t.string,
  //   name: 'name',
  //   comment: 'Name field',
  //   nullable: false,
  // })
  // public name: string;

  public constructor(params: {
    // TODO: Add constructor parameters
  }) {
    super();
    // TODO: Initialize properties
  }
}
```

### Repository File Template

```typescript
import { EntityRepository } from '@mikro-orm/core';
import type { <Name>Entity } from '@/entities/<name>.entity.js';
import { e } from '@/schemas/error.js';

export class <Name>Repository extends EntityRepository<<Name>Entity> {
  /**
   * Find by ID or throw
   */
  public async findByIdOrFail(id: string): Promise<<Name>Entity> {
    return this.findOneOrFail(
      { id },
      { failHandler: () => new e.NotFound.Error() },
    );
  }

  // TODO: Add custom repository methods
}
```

### Test File Template

```typescript
import { describe, expect, test } from 'vitest';
import { setupTestServer } from '@/test-utils/index.js';
import { <Name>Entity } from './<name>.entity.js';

const app = setupTestServer();

describe('<Name>Entity', () => {
  test('should create entity with default values', async () => {
    await app.mikro.em.fork().transactional(async (em) => {
      const entity = new <Name>Entity({
        // TODO: Add test parameters
      });

      expect(entity.id).toBeDefined();
      expect(entity.created_at).toBeInstanceOf(Date);
      expect(entity.updated_at).toBeInstanceOf(Date);
    });
  });

  test('should persist and retrieve entity', async () => {
    await app.mikro.em.fork().transactional(async (em) => {
      const entity = new <Name>Entity({
        // TODO: Add test parameters
      });

      em.persist(entity);
      await em.flush();

      const found = await em.findOne(<Name>Entity, { id: entity.id });
      expect(found).toBeDefined();
      expect(found?.id).toBe(entity.id);
    });
  });
});
```

## Property Types

Common MikroORM property types:
- `t.string` - VARCHAR/TEXT
- `t.integer` - INTEGER
- `t.boolean` - BOOLEAN
- `t.datetime` - TIMESTAMP
- `t.uuid` - UUID
- `t.json` - JSONB/JSON
- `t.text` - TEXT (long strings)

## Relationships

For relationships, add:
- `@ManyToOne(() => OtherEntity)` - Many-to-one
- `@OneToMany(() => OtherEntity, e => e.thisEntity)` - One-to-many
- `@OneToOne(() => OtherEntity)` - One-to-one

## After Generation

1. Add properties with `@Property` decorator
2. Update constructor parameters
3. Add relationship decorators if needed
4. Add custom repository methods
5. Run migration: `/db-migrate create`
6. Run tests: `/test <name>.entity.test.ts`

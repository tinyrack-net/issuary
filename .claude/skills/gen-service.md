# gen-service

Generate a new Fastify service plugin following project conventions.

## Usage

```
/gen-service <name>
```

## Arguments

- `<name>`: Service name in lowercase (e.g., `audit`, `notification`)

## Instructions

When the user invokes this skill:

1. Parse the service name
2. Convert to appropriate formats:
   - Class name: `<Name>Service` (e.g., `AuditService`)
   - Plugin name: `<name>-service-plugin`
   - File name: `<name>.service.ts`
3. Create files:
   - `packages/backend/src/services/<name>.service.ts`
   - `packages/backend/src/services/<name>.service.test.ts`

### Service File Template

```typescript
import fastifyPlugin from 'fastify-plugin';
import type { MikroService } from '@/plugins/mikro-orm.js';
import type { InternalAppConfig } from '@/lib/config/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    <name>Service: <Name>Service;
  }
}

export class <Name>Service {
  public constructor(
    private readonly mikro: MikroService,
    private readonly config: InternalAppConfig,
  ) {}

  // TODO: Add service methods
  // Example:
  // public async create(params: { ... }): Promise<...> {
  //   // Implementation
  // }
}

export default fastifyPlugin(
  async (fastify) => {
    const <name>Service = new <Name>Service(
      fastify.mikro,
      fastify.config,
    );
    fastify.decorate('<name>Service', <name>Service);
  },
  {
    name: '<name>-service-plugin',
    dependencies: ['base-service-plugin', 'mikro-orm-plugin', 'config-plugin'],
  },
);
```

### Test File Template

```typescript
import { describe, expect, test } from 'vitest';
import { setupTestServer } from '@/test-utils/index.js';

const app = setupTestServer();

describe('<Name>Service', () => {
  test('should be decorated on fastify instance', async () => {
    expect(app.<name>Service).toBeDefined();
    expect(app.<name>Service).toBeInstanceOf(Object);
  });

  // TODO: Add service method tests
  // Example:
  // test('should create record', async () => {
  //   const result = await app.<name>Service.create({
  //     // parameters
  //   });
  //   expect(result).toBeDefined();
  // });
});
```

## Common Dependencies

Inject common dependencies via constructor:
- `MikroService` - Database access via `fastify.mikro`
- `InternalAppConfig` - Configuration via `fastify.config`
- Other services - Import and inject as needed

## Service Patterns

### Database Operations
```typescript
public async findById(id: string) {
  const repo = this.mikro.em.getRepository(SomeEntity);
  return repo.findOne({ id });
}
```

### Using Other Services
```typescript
export class NotificationService {
  public constructor(
    private readonly mikro: MikroService,
    private readonly emailService: EmailService,
  ) {}
}
```

### Error Handling
```typescript
import { e } from '@/schemas/error.js';

public async verify(params: { ... }) {
  if (!valid) {
    throw new e.ValidationError.Error('Invalid input');
  }
}
```

## After Generation

1. Add service methods
2. Inject additional dependencies if needed
3. Update dependencies array in plugin options
4. Add test cases for each method
5. Run `/test <name>.service.test.ts` to verify

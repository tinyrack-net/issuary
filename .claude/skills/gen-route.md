# gen-route

Generate a new Fastify API route with test file following project conventions.

## Usage

```
/gen-route <path> --method <method>
```

## Arguments

- `<path>`: Route path (e.g., `api/v1/users`, `api/v1/users/_id`)
- `--method <method>`: HTTP method (get, post, put, delete, patch)

## Instructions

When the user invokes this skill:

1. Parse the path and method arguments
2. Create the route file at `packages/backend/src/routes/<path>/<method>.ts`
3. Create the test file at `packages/backend/src/routes/<path>/<method>.test.ts`

### Route File Template

```typescript
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * <METHOD> /<path>
 *
 * TODO: Add description
 */
export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: '<METHOD>',
    url: '',
    schema: {
      summary: 'TODO: Add summary',
      description: 'TODO: Add description',
      tags: [TAGS.TODO],
      response: {
        200: r.OkResponse,
      },
    },
    handler: async (_req, res) => {
      return res.status(200).send({ ok: true });
    },
  });
};
```

### Test File Template

```typescript
import { describe, expect, test } from 'vitest';
import { setupTestServer } from '@/test-utils/index.js';

const app = setupTestServer();

describe('<METHOD> /<path>', () => {
  test('should return 200 on success', async () => {
    const res = await app.inject({
      method: '<METHOD>',
      url: '/<path>',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('ok', true);
  });
});
```

## File Naming Conventions

- `get.ts` / `get.test.ts` for GET requests
- `post.ts` / `post.test.ts` for POST requests
- `put.ts` / `put.test.ts` for PUT requests
- `delete.ts` / `delete.test.ts` for DELETE requests
- `patch.ts` / `patch.test.ts` for PATCH requests

## Dynamic Parameters

For routes with dynamic parameters (e.g., `/users/:id`):
- Use underscore prefix: `api/v1/users/_id/`
- The `_id` folder represents `:id` parameter

## Notes

- Always use `@/` path aliases for imports
- Use Zod schemas from `@/schemas/` for validation
- Add proper TAGS for Swagger documentation
- Handler receives typed `req` and `res` objects
- Use `_req` or `_res` prefix for unused parameters

## After Generation

1. Update the TAGS import if needed
2. Add request body schema if POST/PUT/PATCH
3. Add proper response schemas
4. Implement the handler logic
5. Add more test cases as needed
6. Run `/test` to verify

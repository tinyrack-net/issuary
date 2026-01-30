# gen-schema

Generate a new Zod validation schema following project conventions.

## Usage

```
/gen-schema <name> --type <type>
```

## Arguments

- `<name>`: Schema name (e.g., `user-profile`, `audit-log`)
- `--type <type>`: Schema type (field, response, error)

## Instructions

When the user invokes this skill:

1. Parse the name and type arguments
2. Create the schema file at `packages/backend/src/schemas/<name>.ts`
3. Update the appropriate index export if needed

### Field Schema Template (--type field)

For reusable field validators:

```typescript
import { z } from 'zod/v4';

/**
 * <Name> field schemas
 */
export const <name>Fields = {
  // Example fields:
  // id: z.string().uuid().describe('Unique identifier'),
  // name: z.string().min(1).max(100).describe('Display name'),
  // email: z.email().describe('Email address'),
  // status: z.enum(['active', 'inactive']).describe('Status'),

  // TODO: Add field schemas
};
```

### Response Schema Template (--type response)

For API response schemas:

```typescript
import { z } from 'zod/v4';

/**
 * <Name> response schemas
 */
export const <Name>Response = z.object({
  // Example:
  // id: z.string().uuid(),
  // name: z.string(),
  // created_at: z.string().datetime(),

  // TODO: Add response fields
});

export const <Name>ListResponse = z.object({
  items: z.array(<Name>Response),
  total: z.number(),
});
```

### Error Schema Template (--type error)

For error definitions using the project's error factory:

```typescript
import { createError } from './error.js';

/**
 * <Name> error definitions
 */
export const <Name>NotFound = createError({
  code: '<NAME>_NOT_FOUND',
  httpStatus: 404,
  message: '<Name> not found',
});

export const Invalid<Name> = createError({
  code: 'INVALID_<NAME>',
  httpStatus: 400,
  message: 'Invalid <name> data',
});

// TODO: Add more error definitions
```

## Using Existing Patterns

### Field Validators (from field.ts)
```typescript
export const f = {
  userEmail: z.email().describe('User email address'),
  userPassword: z.string().min(6).max(100).describe("User's password"),
  // ... more fields
};
```

### Response Patterns (from response.ts)
```typescript
export const r = {
  OkResponse: z.object({ ok: z.literal(true) }),
  UserSession: z.object({ ... }),
  // ... more responses
};
```

### Error Patterns (from error.ts)
```typescript
export const e = {
  InvalidEmailOrPassword: createError({
    code: 'INVALID_EMAIL_OR_PASSWORD',
    httpStatus: 401,
    message: 'Invalid email or password',
  }),
  // ... more errors
};
```

## Common Zod Types

- `z.string()` - String validation
- `z.number()` - Number validation
- `z.boolean()` - Boolean validation
- `z.email()` - Email validation
- `z.uuid()` - UUID validation
- `z.enum(['a', 'b'])` - Enum validation
- `z.object({})` - Object schema
- `z.array()` - Array validation
- `z.optional()` - Optional field
- `z.nullable()` - Nullable field

## After Generation

1. Add your schema definitions
2. Export from appropriate index file
3. Import where needed:
   - Fields: `import { f } from '@/schemas/field.js'`
   - Responses: `import { r } from '@/schemas/response.js'`
   - Errors: `import { e } from '@/schemas/error.js'`
4. Use in route schemas for validation

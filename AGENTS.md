# Agent Development Guide

This document provides guidelines for AI coding agents working in the tinyrack/auth repository.

## Project Structure

This is a monorepo with the following packages:
- `packages/backend` - Fastify-based OAuth2/OIDC authentication server
- `packages/frontend` - React frontend using TanStack Router and Daisy UI
- `packages/client-test` - Next.js test client

## Build, Lint, and Test Commands

### Root Level
```bash
pnpm dev        # Start all packages in dev mode
pnpm build      # Build all packages
```

### Backend (packages/backend)
```bash
pnpm dev                    # Development mode with hot reload
pnpm dev:test               # Dev mode with test environment
pnpm build                  # Compile TypeScript
pnpm build:watch            # Watch mode compilation
pnpm test                   # Run all tests with Vitest
pnpm test <filename>        # Run single test file
pnpm start                  # Start production server
pnpm serve                  # Serve production build
```

### Frontend (packages/frontend)
```bash
pnpm dev        # Start Vite dev server
pnpm build      # Build for production
pnpm preview    # Preview production build
```

### Running Single Tests
To run a single test file:
```bash
cd packages/backend
pnpm test src/routes/application/oauth/authorize/get.test.ts
```

To run tests in watch mode:
```bash
cd packages/backend
pnpm test --watch
```

## Code Style Guidelines

### Formatter and Linter
- Use **Biome** for formatting and linting (NOT Prettier/ESLint)
- Line width: 80 characters
- Indentation: 2 spaces (not tabs)
- Quote style: Single quotes for JavaScript/TypeScript
- Organize imports automatically using Biome

### Import Conventions
- Use path aliases: `@/` maps to `src/` directory
- Always include `.js` extension for local imports (ESM requirement)
- Group imports: external libraries first, then local imports
- Example:
```typescript
import z from 'zod';
import { UserSchema } from '@/schemas/user.js';
import type { FastifyWithZodInstance } from '@/server.js';
```

### TypeScript Configuration
- **Strict mode enabled** with additional strict checks
- `noUncheckedIndexedAccess: true` - always check array/object access
- `exactOptionalPropertyTypes: true` - distinguish undefined from missing
- `noImplicitReturns: true` - all code paths must return
- `noUnusedParameters: true` - remove unused parameters
- `strictNullChecks: true` - strict null/undefined handling
- Use `type` imports when importing types only

### Naming Conventions
- **Files**: kebab-case (e.g., `user.entity.ts`, `oauth-client.repository.ts`)
- **Classes**: PascalCase with descriptive suffixes
  - Entities: `UserEntity`, `OAuthClientEntity`
  - Repositories: `UserRepository`, `OAuthCodeRepository`
  - Schemas: `UserSchema`, `ProviderSchema`
- **Functions/Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Database columns**: snake_case (e.g., `email_verified`, `password_hash`)

### Module System
- Use **ESM modules** (not CommonJS)
- Module resolution: `nodenext`
- Always use `.js` extensions in imports for local files
- Use `type: "module"` in package.json

### Backend-Specific Patterns

#### Zod Schema Validation
- **Always use Zod v4 API** for all schema definitions
- Use the new v4 syntax for all schema methods and types
- Refer to Zod v4 documentation for updated API usage

#### Route Handlers
- Export default function accepting `FastifyWithZodInstance`
- Use Zod schemas for request/response validation
- Structure: method, url, schema (with tags/summary), handler
- Example:
```typescript
export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Login',
      tags: ['User'],
      body: z.object({ /* ... */ }),
      response: { 200: z.object({ /* ... */ }) },
    },
    handler: async (req, res) => { /* ... */ },
  });
```

#### Entity Classes (MikroORM)
- Extend `BaseEntity`
- Use decorators: `@Entity`, `@Property`, `@PrimaryKey`, etc.
- UUID primary keys generated via `crypto.randomUUID()`
- Snake_case for database column names
- Use `t.*` type helpers for precision
- Lazy load sensitive fields (e.g., `password_hash`)
- Include JSDoc-style comments in decorators
- Use lifecycle hooks: `@BeforeCreate`, `@BeforeUpdate`

#### Repositories
- Extend `EntityRepository<T>`
- Custom business logic methods (e.g., `login`, `exists`)
- Use `findOneOrFail` with custom error handlers
- Type-safe query building

#### Testing (Vitest)
- Create `beforeAll`/`afterAll` hooks for server lifecycle
- Use `app.inject()` for testing HTTP endpoints
- Test files: `*.test.ts` suffix
- Structure: setup, teardown, test cases with descriptive names

### Frontend-Specific Patterns

#### React Components
- Use functional components with hooks
- TanStack Router for routing with `createFileRoute`
- Daisy UI components for UI (Tailwind V4 CSS-based)
- TanStack Query for data fetching
- Forms: use React Hook Form with Zod validation via `zodResolver`
- Icons: use **Phosphor Icons** for all icon components

#### Internationalization (i18n)
- **Always use i18n** for all user-facing text in frontend components
- Use `react-i18next` with `useTranslation` hook
- Never hardcode text strings - always use translation keys
- Translation files: `src/i18n/locales/{ko,en,ja}.json` (flat structure)
- Supported languages: Korean (ko), English (en), Japanese (ja)
- Example:
```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('login.title')}</h1>
      <button>{t('login.submit')}</button>
      <p>{t('common.theme.current', { theme: 'dark' })}</p>
    </div>
  );
}
```
- For Zod validation messages, create schema inside component with `useMemo`:
```typescript
const { t } = useTranslation();

const schema = useMemo(
  () => z.object({
    email: z.string().email(t('validation.email.invalid')),
  }),
  [t]
);
```
- Add new translation keys to all three language files (ko.json, en.json, ja.json)
- Use `useLanguage()` hook for language switching: `const { language, setLanguage } = useLanguage();`

#### State Management
- TanStack Query for server state
- Query options pattern: export reusable `queryOptions` and `mutationOptions`
- Invalidate queries appropriately in mutation callbacks
- Example:
```typescript
const mutation = useMutation({
  ...mutationOptions,
  onSuccess: async (data) => {
    queryClient.setQueryData(queryKey, data);
    await tick();
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey });
  }
});
```

### Error Handling
- Create specific error instances with clear messages
- Use try-catch in async functions
- Provide meaningful error messages for users
- Use `failHandler` in repository queries for custom errors
- Example:
```typescript
const err = new Error('Invalid combination of email and password');
const user = await this.findOneOrFail(
  { email: params.email },
  { failHandler: () => err }
);
```

## Environment Variables
- Backend uses environment-specific configs via `APP_ENV`
- Config file: `config.yaml`
- Example file: `.env.example`
- Environments: `test`, `development`, `production`

## Database
- ORM: **MikroORM**
- Supported: PostgreSQL, SQLite
- Migrations stored in entities with decorators
- Seeders in `src/seeders/`

## MCP Tool Usage
- **Actively use MCP (Model Context Protocol) tools** for documentation and web searches
- Use `context7_resolve-library-id` and `context7_query-docs` for library documentation
- Use `zread_search_doc`, `zread_read_file`, `zread_get_repo_structure` for GitHub repositories
- Use `web-search-prime_webSearchPrime` for general web searches
- Prefer official documentation via MCP tools over guessing API usage
- Maximum 3 calls per tool per question - use best available information

## General Best Practices
- Write descriptive commit messages
- Keep functions small and focused
- Use async/await (not callbacks)
- Validate all user input with Zod
- Type everything - avoid `any`
- Use descriptive variable names
- Comment complex business logic
- Follow DRY principles

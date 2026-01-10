# Agent Development Guide

This document provides guidelines for AI coding agents working in the tinyrack/auth repository.

## Project Overview

This project is an **OpenID Connect (OIDC) Provider** implementation that provides OAuth2 and OIDC authentication services. It acts as an identity provider (IdP) that allows client applications to authenticate users and obtain identity information through standard OIDC flows.

### Key Features
- Full OAuth2 and OIDC protocol support
- Authorization Code Flow with PKCE
- Client credentials management
- Token issuance and validation (ID tokens, access tokens, refresh tokens)
- User authentication and consent management
- Multi-language support (Korean, English, Japanese)

## Project Structure

This is a monorepo with the following packages:
- `packages/backend` - Fastify-based OAuth2/OIDC authentication server
- `packages/frontend` - React frontend using TanStack Router and Daisy UI
- `packages/client-test` - Next.js test client

### Backend Directory Structure
```
packages/backend/src/
├── db/                    # Database configurations (sqlite, postgres, memory)
├── entities/              # MikroORM entity definitions (*.entity.ts)
├── repositories/          # Custom repository classes (*.repository.ts)
├── services/              # Business logic services (*.service.ts)
├── routes/                # HTTP route handlers
│   ├── api/v1/           # API endpoints (/api/v1/*)
│   └── application/      # OAuth/OIDC endpoints (/application/*)
├── schemas/               # Zod validation schemas
│   ├── error.ts          # Centralized error definitions
│   ├── field.ts          # Reusable field schemas
│   ├── response.ts       # Response type schemas
│   └── provider.ts       # Provider schemas
├── plugins/               # Fastify plugins (auto-loaded)
├── handlers/              # Reusable request handlers
├── lib/                   # Utility libraries (config, jwt, pkce, env)
├── migrations/            # Database migration files
└── seeders/               # Database seeders
```

### Frontend Directory Structure
```
packages/frontend/src/
├── routes/                # TanStack Router file-based routes
│   ├── __root.tsx        # Root layout
│   ├── index.tsx         # Home page
│   ├── login/            # Login page
│   ├── register/         # Registration page
│   ├── profile/          # Profile page
│   └── verify-email/     # Email verification
├── hooks/                 # Custom React hooks
├── queries/               # TanStack Query options (queryOptions, mutationOptions)
├── i18n/                  # Internationalization
│   ├── index.ts          # i18n setup
│   └── locales/          # Translation files (ko.json, en.json, ja.json)
├── libs/                  # Utility libraries
│   ├── etch.ts           # Fetch wrapper
│   ├── router.ts         # Router setup
│   ├── query-client.ts   # QueryClient instance
│   └── promise.ts        # Utility functions (tick)
├── main.tsx               # Entry point
└── index.css              # Global styles (Tailwind + DaisyUI)
```

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
pnpm dev        # Build for development (watch mode)
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

#### Zod Schema Organization
Schemas are organized into specialized files for reusability:
- **`schemas/field.ts`** - Reusable field definitions with `f` namespace
  - Example: `f.userEmail`, `f.userId`, `f.password`
  - Use these for consistent validation across routes
- **`schemas/response.ts`** - Response type schemas with `r` namespace
  - Example: `r.UserSession`, `r.OAuthClient`
  - Define all API response structures here
- **`schemas/error.ts`** - Centralized error definitions with `e` namespace
  - Example: `e.InvalidEmailOrPassword`, `e.UserNotFound`
  - Each error includes status code, error code, and message
- **`schemas/provider.ts`** - Provider-specific schemas with `zz` namespace
  - Example: `zz.PORT`, `zz.URL`
  - Custom Zod types for special validations

#### File-Based Routing
Routes use `@fastify/autoload` with directory-to-URL mapping:
- **HTTP method = filename**: `get.ts`, `post.ts`, `put.ts`, `delete.ts`, `patch.ts`
- **Dynamic parameters**: Use underscore prefix (e.g., `_id/`, `_provider_id/`)
- **URL mapping**: Directory structure maps directly to URL paths
  - `routes/api/v1/users/get.ts` → `GET /api/v1/users`
  - `routes/api/v1/users/_id/get.ts` → `GET /api/v1/users/:id`
- **Test files**: Colocated with route files (e.g., `post.test.ts` alongside `post.ts`)
- **Route groups**: Use `application/` for OAuth/OIDC endpoints, `api/v1/` for REST API

#### Route Handlers
- Export default function accepting `FastifyWithZodInstance`
- Use Zod schemas for request/response validation
- Structure: method, url, schema (with tags/summary), handler
- Example:
```typescript
export default (fastify: FastifyWithZodInstance) => {
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
}
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

#### Services
Services are Fastify plugins that encapsulate business logic:
- Export a class with business logic methods
- Use `fastify-plugin` wrapper
- Declare module augmentation for `FastifyInstance`
- Specify plugin dependencies

Example:
```typescript
declare module 'fastify' {
  interface FastifyInstance {
    userService: UserService;
  }
}

export class UserService {
  constructor(private readonly mikro: MikroService) {}
  // Business logic methods here
}

export default fastifyPlugin(
  async (fastify) => {
    fastify.decorate('userService', new UserService(fastify.mikro));
  },
  {
    name: 'user-service-plugin',
    dependencies: ['base-service-plugin'],
  }
);
```

#### Session Management
- Uses `@fastify/secure-session` with cookie-based sessions
- Session data typed via module declaration
- Access session data:
  - Read: `const user = req.session.get('user')`
  - Write: `req.session.set('user', userData)`
  - Delete: `req.session.delete()`

#### Password Hashing
- Uses `argon2` for all password/secret hashing
- Automatic hashing in entity lifecycle hooks (`@BeforeCreate`, `@BeforeUpdate`)
- Password verification via entity method: `user.verifyPassword(password)`
- Never store plain-text passwords

#### JWT Token Management
- Uses `jose` library (NOT `jsonwebtoken`)
- Token types: access token, refresh token, ID token (OIDC)
- Algorithm: HS256 with secret from config
- Token generation: `lib/jwt.ts` provides signing/verification utilities

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

#### Build Configuration
- Frontend builds to `../backend/public/` directory
- Backend serves the static frontend files in production
- Vite dev server proxies API requests to backend (port 8080)
- Production: Single server serves both frontend and backend

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
- Centralize query/mutation logic in `queries/` directory
- Example:
```typescript
// queries/example.ts
export const exampleQueryOptions = queryOptions({
  queryKey: ['/api/endpoint'],
  queryFn: async () => {
    const res = await etch('/api/endpoint');
    return res.json() as Promise<ResponseType>;
  },
});

export const exampleMutationOptions = mutationOptions({
  mutationFn: async (params: ParamsType) => {
    const res = await etch('/api/endpoint', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.json() as Promise<ResponseType>;
  },
});
```
- Invalidate queries appropriately in mutation callbacks
- Use `tick()` utility to wait for state updates before navigation
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

#### HTTP Client (etch)
- Use `etch()` wrapper from `libs/etch.ts` for all HTTP requests
- Centralized error handling and JSON headers
- Throws on non-ok responses
- Example:
```typescript
import { etch } from '@/libs/etch.js';

const res = await etch('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify(data),
});
const json = await res.json();
```

### Error Handling
- Centralized error definitions in `schemas/error.ts` using `createError` function
- Each error includes HTTP status code, error code, and message
- Use `e` namespace for error access
- Throw errors: `throw new e.ErrorName.Error()`
- Schema validation: `response: { 401: e.ErrorName.Schema }`
- Example:
```typescript
// In schemas/error.ts
export const e = {
  InvalidEmailOrPassword: createError(
    401,
    'INVALID_EMAIL_OR_PASSWORD',
    'The provided email or password is incorrect.'
  ),
};

// In route handler
throw new e.InvalidEmailOrPassword.Error();

// In route schema
response: {
  200: SuccessSchema,
  401: e.InvalidEmailOrPassword.Schema,
}
```
- Use `failHandler` in repository queries for custom errors
- Example:
```typescript
const err = new Error('Invalid combination of email and password');
const user = await this.findOneOrFail(
  { email: params.email },
  { failHandler: () => err }
);
```

## Configuration

### Backend Configuration
- Backend settings are injected through `packages/backend/config.yaml`
- Configuration is loaded and validated via `packages/backend/src/lib/config.ts`
- Config file location:
  - Default: `/opt/config.yaml` (production)
  - Can be overridden via `CONFIG_PATH` environment variable
  - Test environment: `./config.test.yaml` (when `APP_ENV=test`)
- YAML config supports environment variable interpolation using `!env` tag
  - Example: `password: !env SMTP_PASSWORD`
- All config is validated against Zod schemas at startup
- Config sections:
  - `app`: Application settings (host, port, JWT secrets, language settings)
  - `admin`: Admin interface settings
  - `database`: Database connection (SQLite, PostgreSQL, or in-memory)
  - `smtp`: Email service configuration
  - `authentication_methods`: Enabled auth methods (password, OAuth, etc.)
  - `providers`: Pre-configured OAuth clients
  - `users`: Pre-seeded users

### Config-based Data Source
- Users and OAuth clients defined in `config.yaml` act as a **separate data source** (NOT seeded to database)
- When querying users or OAuth clients, the application searches **both** config and database
- Config-based data takes priority over database (checked first)
- Config users/providers are marked with `managed: 'config'`, DB entries with `managed: 'database'`
- Config-based entities cannot be modified at runtime (immutable)
- Use cases: infrastructure-as-code for admin users, static OAuth clients for trusted applications
- Example pattern:
```typescript
// Always check config first, then database
const appConfigUser = AppConfigs.users?.find((u) => u.id === id);
if (appConfigUser) {
  return { ...appConfigUser, managed: 'config' };
}
const dbUser = await this.mikro.user.findOneOrFail({ id });
return { ...dbUser, managed: 'database' };
```

### Environment Variables
- `APP_ENV`: Environment mode (`test`, `development`, `production`)
- `CONFIG_PATH`: Override default config file path
- Example file: `.env.example`

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

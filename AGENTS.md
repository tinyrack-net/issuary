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
- `packages/next-basic` - Next.js test client

### Backend Directory Structure
```
packages/backend/src/
├── index.ts               # Entry point
├── server.ts              # Fastify server setup
├── db/                    # Database configurations (sqlite, postgres, memory)
│   ├── index.ts           # Database config factory
│   ├── cli.ts             # MikroORM CLI configuration
│   ├── memory.ts          # In-memory database config (for testing)
│   ├── postgres.ts        # PostgreSQL config
│   └── sqlite.ts          # SQLite config
├── entities/              # MikroORM entity definitions (*.entity.ts)
│   ├── base.entity.ts             # Base entity class with common fields
│   ├── user.entity.ts             # User accounts
│   ├── user-oauth.entity.ts       # OAuth linked accounts (social login)
│   ├── user-passkey.entity.ts     # WebAuthn/Passkey credentials
│   ├── user-totp.entity.ts        # TOTP 2FA credentials
│   ├── jwt-key.entity.ts          # RS256 key pairs for JWT signing
│   ├── oauth-client.entity.ts     # OAuth client applications
│   ├── oauth-code.entity.ts       # Authorization codes
│   ├── user-consent.entity.ts     # User consent records
│   ├── email-verification.entity.ts
│   ├── password-reset.entity.ts
│   └── revoked-token.entity.ts    # Revoked JWT tokens
├── repositories/          # Custom repository classes (*.repository.ts)
│   ├── user.repository.ts
│   ├── user-oauth.repository.ts
│   ├── user-passkey.repository.ts
│   ├── user-totp.repository.ts
│   ├── user-consent.repository.ts
│   ├── oauth-client.repository.ts
│   ├── oauth-code.repository.ts
│   ├── jwt-key.repository.ts
│   ├── email-verification.repository.ts
│   ├── password-reset.repository.ts
│   └── revoked-token.repository.ts
├── services/              # Business logic services (*.service.ts)
│   ├── base.service.ts            # Base service with MikroORM access
│   ├── user.service.ts            # User management
│   ├── jwt.service.ts             # RS256 JWT signing/verification
│   ├── jwt-key.service.ts         # Key rotation and JWKS management
│   ├── oauth-authorize.service.ts # Authorization endpoint logic
│   ├── oauth-client.service.ts    # OAuth client management
│   ├── oauth-connect.service.ts   # Social login (Google, GitHub, Apple)
│   ├── oauth-token.service.ts     # Token issuance service
│   ├── passkey.service.ts         # WebAuthn/Passkey service
│   ├── totp.service.ts            # TOTP 2FA service
│   ├── email.service.ts           # Email sending service
│   ├── email-verification.service.ts
│   ├── password-reset.service.ts
│   └── user-consent.service.ts
├── routes/                # HTTP route handlers
│   ├── api/v1/           # REST API endpoints (/api/v1/*)
│   │   ├── auth/         # Authentication routes (login, register, etc.)
│   │   ├── user/         # User management routes (session, password, passkeys, totp)
│   │   ├── oauth/        # External OAuth providers routes
│   │   ├── consent/      # OAuth consent routes
│   │   ├── config/       # App config routes
│   │   └── health/       # Health check routes
│   └── application/      # OAuth/OIDC endpoints (/application/*)
│       └── oauth/        # authorize, token, userinfo, introspect, revoke, .well-known
├── schemas/               # Zod validation schemas
│   ├── error.ts          # Centralized error definitions (e.*)
│   ├── field.ts          # Reusable field schemas (f.*)
│   ├── response.ts       # Response type schemas (r.*)
│   ├── provider.ts       # Provider schemas (zz.*)
│   ├── header.ts         # Header schemas
│   ├── jwt.ts            # JWT-related schemas
│   ├── jwt-key.ts        # JWT key schemas
│   ├── oauth.ts          # OAuth request/response schemas
│   ├── oauth-connect.ts  # OAuth connect schemas
│   ├── passkey.ts        # Passkey/WebAuthn schemas
│   └── totp.ts           # TOTP schemas
├── plugins/               # Fastify plugins (auto-loaded)
│   ├── api-error-handler.ts  # Error handling plugin
│   ├── bootstrap.ts          # App bootstrap plugin
│   ├── cookie.ts             # Cookie plugin
│   ├── cors.ts               # CORS configuration
│   ├── formbody.ts           # Form body parser
│   ├── mikro-orm.ts          # MikroORM integration
│   ├── nodemailer.ts         # Email transport plugin
│   ├── scalar.ts             # Scalar API reference
│   ├── secure-session.ts     # Session management
│   ├── static.ts             # Static file serving
│   ├── swagger.ts            # Swagger/OpenAPI
│   └── zod.ts                # Zod type provider
├── lib/                   # Utility libraries
│   ├── env.ts            # Environment utilities
│   ├── pkce.ts           # PKCE utilities
│   ├── scopes.ts         # OAuth scope utilities
│   ├── swagger-tags.ts   # Swagger tag definitions
│   └── config/           # Configuration system
│       ├── index.ts      # Config exports
│       ├── loader.ts     # Config file loader
│       ├── oauth-resolver.ts  # OAuth provider resolver
│       └── schemas/      # Config validation schemas
│           ├── root.ts       # Root config schema
│           ├── app.ts        # App config schema
│           ├── database.ts   # Database config schema
│           ├── smtp.ts       # SMTP config schema
│           ├── auth-basic.ts # Basic auth config schema
│           ├── auth-oauth.ts # OAuth auth config schema
│           ├── provider.ts   # Provider config schema
│           └── user.ts       # User config schema
├── test-utils/            # Test utilities and helpers
│   ├── index.ts          # Re-exports
│   ├── setup.ts          # setupTestServer() function
│   ├── helpers.ts        # Common test helpers
│   ├── fixtures.ts       # Test constants (TEST_USER, TEST_OAUTH_CLIENT)
│   └── oauth.ts          # OAuth flow helpers
└── seeders/               # Database seeders
    ├── config.seeder.ts  # Config-based seeder
    └── test-seeder.ts    # Test data seeder
```

### Frontend Directory Structure
```
packages/frontend/src/
├── main.tsx               # Entry point
├── index.css              # Global styles (Tailwind + DaisyUI)
├── routeTree.gen.ts       # Generated route tree (auto-generated)
├── components/            # React components
│   ├── error-boundary.tsx         # Error boundary wrapper
│   ├── auth/                      # Authentication components
│   │   ├── auth-page-layout.tsx   # Auth page layout wrapper
│   │   ├── footer-link.tsx        # Footer link component
│   │   ├── icon-input.tsx         # Input with icon
│   │   ├── oauth-buttons.tsx      # OAuth provider buttons
│   │   ├── page-header.tsx        # Page header component
│   │   └── submit-button.tsx      # Form submit button
│   ├── modals/                    # Modal components
│   │   └── profile/               # Profile-related modals
│   │       ├── change-password-modal.tsx
│   │       ├── disable-totp-modal.tsx
│   │       ├── manage-passkeys-modal.tsx
│   │       ├── remove-password-modal.tsx
│   │       ├── set-password-modal.tsx
│   │       ├── setup-passkey-modal.tsx
│   │       └── setup-totp-modal.tsx
│   ├── profile/                   # Profile section components
│   │   ├── linked-accounts-section.tsx
│   │   ├── passkey-section.tsx
│   │   ├── password-section.tsx
│   │   ├── totp-section.tsx
│   │   └── user-info-section.tsx
│   ├── skeletons/                 # Loading skeleton components
│   │   ├── auth-page-skeleton.tsx
│   │   ├── consent-skeleton.tsx
│   │   ├── profile-skeleton.tsx
│   │   └── skeleton.tsx
│   └── ui/                        # Generic UI components
│       ├── alert.tsx
│       ├── divider.tsx
│       ├── language-selector.tsx
│       ├── modal.tsx
│       └── theme-toggle.tsx
├── hooks/                 # Custom React hooks
│   ├── use-language.ts   # Language switching hook
│   └── use-theme.ts      # Theme switching hook
├── queries/               # TanStack Query options (queryOptions, mutationOptions)
│   ├── keys.ts           # Query key definitions
│   ├── session.ts        # Session query options
│   ├── config.ts         # App config query options
│   ├── login.ts          # Login mutation options
│   ├── register.ts       # Register mutation options
│   ├── logout.ts         # Logout mutation options
│   ├── oauth.ts          # OAuth providers query/mutation options
│   ├── consent.ts        # Consent query/mutation options
│   ├── password.ts       # Password management mutations
│   ├── password-reset.ts # Password reset mutation options
│   ├── verify-email.ts   # Email verification mutation options
│   ├── passkey.ts        # Passkey mutation options
│   └── totp.ts           # TOTP mutation options
├── routes/                # TanStack Router file-based routes
│   ├── __root.tsx        # Root layout
│   ├── index.tsx         # Home page
│   ├── login/index.tsx   # Login page
│   ├── register/index.tsx # Registration page
│   ├── profile/index.tsx # User profile page
│   ├── verify-email/index.tsx # Email verification
│   ├── forgot-password/index.tsx # Password reset request
│   ├── reset-password/index.tsx # Password reset form
│   ├── consent/index.tsx # OAuth consent page
│   └── error/index.tsx   # Error page
├── i18n/                  # Internationalization
│   ├── index.ts          # i18n setup
│   ├── react-i18next.d.ts # Type declarations
│   └── locales/          # Translation files
│       ├── ko.json       # Korean
│       ├── en.json       # English
│       └── ja.json       # Japanese
└── libs/                  # Utility libraries
    ├── error.ts          # Error utilities (ApiError class)
    ├── etch.ts           # Fetch wrapper
    ├── router.ts         # Router setup
    ├── query-client.ts   # QueryClient instance
    ├── promise.ts        # Utility functions (tick)
    └── oauth-search.ts   # OAuth search params schema
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
- **No barrel exports**: Do not use `index.ts` files for re-exporting modules
  - Import directly from the source file, not from directory index
  - Exception: `index.ts` files that contain actual logic (e.g., `i18n/index.ts`)
- Example:
```typescript
import z from 'zod/v4';
import { UserSchema } from '@/schemas/user.js';
import type { FastifyWithZodInstance } from '@/server.js';

// Direct imports (correct)
import { AuthPageLayout } from '@/components/auth/auth-page-layout.js';
import { Alert } from '@/components/ui/alert.js';

// Barrel exports (avoid)
// import { AuthPageLayout, Alert } from '@/components/index.js';
```

### TypeScript Configuration
- **Strict mode enabled** with additional strict checks
- `noUncheckedIndexedAccess: true` - always check array/object access
- `exactOptionalPropertyTypes: true` - distinguish undefined from missing
- `noImplicitReturns: true` - all code paths must return
- `noUnusedParameters: true` - remove unused parameters
- `strictNullChecks: true` - strict null/undefined handling
- Use `type` imports when importing types only
- **No type assertions or non-null assertions**:
  - Do NOT use `as` type assertions (e.g., `value as string`, `data as UserType`)
  - Do NOT use non-null assertion operator `!` (e.g., `user!.name`, `array[0]!`)
  - Instead, use proper type guards, conditional checks, or refactor code to ensure type safety
  - Exception: `as const` is allowed for literal type inference
  - Example:
```typescript
// Bad - using type assertion
const user = data as UserType;
const name = user!.name;

// Good - using type guards and conditional checks
if (isUserType(data)) {
  const user = data;
  if (user.name) {
    const name = user.name;
  }
}

// Allowed - as const for literal types
const STATUS = { ACTIVE: 'active', INACTIVE: 'inactive' } as const;
```

### Naming Conventions
- **Files**: kebab-case (e.g., `user.entity.ts`, `oauth-client.repository.ts`)
  - Backend: `user.entity.ts`, `oauth-client.repository.ts`, `jwt.service.ts`
  - Frontend components: `auth-page-layout.tsx`, `icon-input.tsx`, `set-password-modal.tsx`
  - Frontend utilities: `use-theme.ts`, `query-client.ts`
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
- Extend `BaseEntity` which provides `created_at` and `updated_at` fields
- Use decorators: `@Entity`, `@Property`, `@PrimaryKey`, `@ManyToOne`, `@Enum`, `@Index`, etc.
- UUID primary keys generated via `crypto.randomUUID()`
- Snake_case for database column names
- Use `t.*` type helpers for column types (`t.uuid`, `t.string`, `t.datetime`, `t.json`, `t.text`, `t.boolean`, `t.bigint`)
- Lazy load sensitive fields with `lazy: true` (e.g., `password_hash`)
- Hide fields from JSON serialization with `hidden: true`
- Include JSDoc-style comments in property decorators
- Use lifecycle hooks: `@BeforeCreate`, `@BeforeUpdate`
- Use `Ref<T>` wrapper for lazy-loaded relations with `ref: true` option
- Example:
```typescript
@Entity({
  tableName: 'user',
  comment: 'Registered users',
  repository: () => UserRepository,
})
export class UserEntity extends BaseEntity {
  [EntityRepositoryType]?: UserRepository;

  @PrimaryKey({ type: t.uuid, name: 'id' })
  public id: string = crypto.randomUUID();

  @Index({ name: 'user_email_unique', properties: ['email'], options: { unique: true } })
  @Property({ type: t.string, name: 'email', comment: 'User email address' })
  public email: string;

  @Property({ type: t.string, name: 'password_hash', nullable: true, lazy: true, hidden: true })
  public password_hash: string | null = null;

  @BeforeCreate()
  @BeforeUpdate()
  async hashPassword(args: EventArgs<UserEntity>) {
    const password = args.changeSet?.payload.password_hash;
    if (password) {
      this.password_hash = await hash(password);  // Uses argon2
    }
  }
}
```

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
- **Algorithm: RS256 asymmetric keys** (NOT HS256 symmetric secret)
- Token types: access token, refresh token, ID token (OIDC)
- Key management via `jwt-key.service.ts`:
  - Automatic key generation and rotation
  - Key lifecycle: `next` -> `active` -> `previous` -> `retired`
  - Keys stored in database (`jwt_key` table)
  - JWKS endpoint: `/.well-known/jwks.json`
- Token generation: `jwt.service.ts` provides signing/verification utilities
- Token structure includes `kid` (Key ID) in JWT header
- Supports token revocation via `revoked_token` table
- Key rotation settings in config:
  - `jwt_key_rotation_enabled`: Enable automatic rotation (default: true)
  - `jwt_key_rotation_days`: Days between rotations (default: 30)
  - `jwt_key_overlap_days`: Days to keep previous keys valid (default: 7)

#### Testing (Vitest)
- Create `beforeAll`/`afterAll` hooks for server lifecycle
- Use `app.inject()` for testing HTTP endpoints
- Test files: `*.test.ts` suffix
- Structure: setup, teardown, test cases with descriptive names

#### Test Utilities (test-utils/)
The `test-utils/` directory provides reusable helpers for testing:

**Setup (`test-utils/setup.ts`):**
- `setupTestServer()` - Returns a proxy to Fastify instance with automatic setup/teardown
- Example:
```typescript
import { setupTestServer } from '@/test-utils/index.js';

const app = setupTestServer();

describe('My Tests', () => {
  test('should work', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
  });
});
```

**Fixtures (`test-utils/fixtures.ts`):**
- `TEST_USER` - Config user credentials (email, password)
- `TEST_OAUTH_CLIENT` - OAuth client config (clientId, clientSecret, redirectUri)
- `TEST_PKCE` - PKCE test vectors (codeChallenge, codeVerifier)
- `DEFAULT_SCOPES` - Default OAuth scopes ('openid profile email')
- `generateUniqueEmail(prefix)` - Generate unique email for tests

**Helpers (`test-utils/helpers.ts`):**
- `createAuthenticatedSession(app, email?, password?)` - Login and return session cookie
- `injectWithSession(app, options, sessionCookie)` - Make request with session cookie
- `extractCookie(res, name)` - Extract cookie value from response
- `grantConsent(app, sessionCookie, params)` - Grant OAuth consent
- `withMikroContext(app, fn)` - Run function in MikroORM RequestContext
- `expectError(res, errorDef)` - Assert error response matches error definition

**OAuth Helpers (`test-utils/oauth.ts`):**
- `getAuthorizationCode(app, params)` - Get OAuth authorization code
- `exchangeCodeForTokens(app, params)` - Exchange code for tokens
- `refreshAccessToken(app, params)` - Refresh access token
- `getAccessToken(app, params?)` - Complete OAuth flow and get access token
- `getUserInfo(app, accessToken)` - Get user info with bearer token

**Test File Pattern:**
```typescript
import { describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import { expectError, generateUniqueEmail, setupTestServer } from '@/test-utils/index.js';

const app = setupTestServer();

describe('POST /api/v1/auth/login', () => {
  test('should login successfully with correct credentials', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: { email: 'test@example.com', password: 'password' },
    });
    expect(res.statusCode).toBe(200);
  });

  test('should fail with wrong password', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'wrong' },
    });
    expectError(res, e.InvalidEmailOrPassword);
  });
});
```

### Frontend-Specific Patterns

#### React Components
- Use functional components with hooks
- TanStack Router for routing with `createFileRoute`
- Daisy UI components for UI (Tailwind V4 CSS-based)
- TanStack Query for data fetching
- Forms: use React Hook Form with Zod validation via `standardSchemaResolver` from `@hookform/resolvers/standard-schema`
- Icons: use **Phosphor Icons** for all icon components
  - Import icons with `Icon` suffix: `CheckCircleIcon`, `EnvelopeSimpleIcon`, etc.
  - Type imports use `Icon` (without suffix): `import type { Icon } from '@phosphor-icons/react'`
  - Example:
```typescript
import { CheckCircleIcon, EnvelopeSimpleIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

// Usage
<CheckCircleIcon className="size-5" weight="fill" />
<EnvelopeSimpleIcon className="size-4" weight="regular" />
```

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

#### Frontend Testing with Playwright
When implementing or modifying frontend features, **actively use Playwright tools** to verify the implementation:

1. **Start the dev server** before testing:
```bash
pnpm dev  # Starts both backend and frontend
```

2. **Use Playwright MCP tools** for interactive testing:
   - `playwright_browser_navigate` - Navigate to pages
   - `playwright_browser_snapshot` - Capture accessibility snapshot (preferred over screenshot)
   - `playwright_browser_click` - Click on elements
   - `playwright_browser_type` - Type text into inputs
   - `playwright_browser_fill_form` - Fill multiple form fields at once
   - `playwright_browser_take_screenshot` - Take visual screenshots when needed

3. **Testing workflow**:
   - Navigate to the page you're implementing (e.g., `http://localhost:8081/login`)
   - Use `playwright_browser_snapshot` to see the current page structure
   - Interact with elements using click, type, or fill_form tools
   - Verify the expected behavior after interactions
   - Take screenshots if visual verification is needed

4. **Example testing session**:
```
# Navigate to login page
playwright_browser_navigate: http://localhost:8081/login

# Take snapshot to see page structure
playwright_browser_snapshot

# Fill login form
playwright_browser_fill_form: email field, password field

# Click submit button
playwright_browser_click: submit button

# Verify navigation or state change
playwright_browser_snapshot
```

5. **When to use Playwright testing**:
   - After implementing new UI components
   - When modifying form behavior or validation
   - To verify navigation flows work correctly
   - When debugging visual or interaction issues
   - To confirm i18n translations display correctly

#### E2E Testing with Playwright
The frontend has a comprehensive E2E test suite using Playwright. Tests are located in `packages/frontend/e2e/`.

**Test Structure:**
```
packages/frontend/e2e/
├── fixtures/
│   └── test-data.ts          # Test constants matching backend config.yaml
├── utils/
│   ├── auth-helpers.ts       # login, logout, register helpers
│   ├── totp-helpers.ts       # TOTP code generation
│   └── oauth-helpers.ts      # OAuth flow helpers
└── tests/
    ├── auth/                 # Authentication tests
    │   ├── login.spec.ts
    │   ├── register.spec.ts
    │   ├── logout.spec.ts
    │   ├── password-reset.spec.ts
    │   ├── totp.spec.ts
    │   └── email-verification.spec.ts
    ├── profile/              # Profile management tests
    │   ├── view-profile.spec.ts
    │   └── manage-password.spec.ts
    └── oauth/                # OAuth/OIDC flow tests
        ├── consent.spec.ts
        └── authorization-flow.spec.ts
```

**Running E2E Tests:**
```bash
cd packages/frontend

# Run all tests (headless)
pnpm test:e2e

# Run with Playwright UI (interactive)
pnpm test:e2e:ui

# Run with visible browser
pnpm test:e2e:headed

# Run in debug mode
pnpm test:e2e:debug

# Run specific test file
pnpm test:e2e e2e/tests/auth/login.spec.ts
```

**Prerequisites:**
- Both dev servers must be running before executing E2E tests:
  ```bash
  # From root directory
  pnpm dev  # Starts both backend (port 8080) and frontend (port 8081)
  ```
- Tests use the config-managed user from `packages/backend/config.yaml`

**Test Data Dependencies:**
Test constants in `e2e/fixtures/test-data.ts` must match `packages/backend/config.yaml`:
```typescript
// Must match config.yaml users section
export const TEST_USER = {
  email: 'test-config-user@example.com',
  password: 'changemelater',
};

// Must match config.yaml providers section
export const TEST_OAUTH_CLIENT = {
  clientId: 'sdlk3n3dkj2',
  redirectUri: 'http://localhost:3000/api/callback',
};
```

**Writing New E2E Tests:**
- Use `test-data.ts` for test constants
- Use helper functions from `utils/` for common operations
- Follow the existing test patterns for consistency
- Tests should be independent and not rely on state from other tests
- Use `prompt=consent` parameter when testing OAuth consent (consent is persisted in DB)

**Test Helpers:**
```typescript
import { login, logout, ensureLoggedOut } from '../utils/auth-helpers';
import { buildAuthorizationUrl } from '../utils/oauth-helpers';
import { generateTotpCode } from '../utils/totp-helpers';

// Login helper
await login(page, TEST_USER.email, TEST_USER.password);

// Logout helper
await logout(page);

// Build OAuth authorization URL
const authUrl = buildAuthorizationUrl({
  clientId: TEST_OAUTH_CLIENT.clientId,
  redirectUri: TEST_OAUTH_CLIENT.redirectUri,
  scope: 'openid profile email',
  prompt: 'consent',  // Force consent page
});
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
  - Test environment: Uses `DEFAULT_TEST_CONFIG` from `test-utils/setup.ts` (runtime injection)
- YAML config supports environment variable interpolation using `!env` tag
  - Example: `password: !env SMTP_PASSWORD`
- All config is validated against Zod schemas at startup
- Config sections:
  - `app`: Application settings (host, port, JWT secrets, language settings)
  - `admin`: Admin interface settings
  - `database`: Database connection (SQLite, PostgreSQL, or in-memory)
  - `smtp`: Email service configuration
  - `basic_authentication_methods`: Password and passkey authentication settings (fixed structure)
    - `password`: Password-based auth settings (enabled, email_verification, totp)
    - `passkey`: Passkey/WebAuthn settings (enabled, email_verification)
  - `oauth_authentication_methods`: External OAuth providers (Google, GitHub, Apple, custom)
  - `providers`: Pre-configured OAuth clients
  - `users`: Pre-seeded users

### Config-based Data Source
- Users and OAuth clients defined in `config.yaml` act as a **separate data source** (NOT seeded to database)
- When querying users or OAuth clients, the application searches **both** config and database
- Config-based data takes priority over database (checked first)
- Config users/providers are marked with `managed_by: 'config'`, DB entries with `managed_by: 'database'`
- Config-based entities cannot be modified at runtime (immutable)
- Use cases: infrastructure-as-code for admin users, static OAuth clients for trusted applications
- Example pattern:
```typescript
// Always check config first, then database
const appConfigUser = AppConfigs.users?.find((u) => u.id === id);
if (appConfigUser) {
  return { ...appConfigUser, managed_by: 'config' };
}
const dbUser = await this.mikro.user.findOneOrFail({ id });
return { ...dbUser, managed_by: 'database' };
```

### Environment Variables
- `APP_ENV`: Environment mode (`test`, `development`, `production`)
- `CONFIG_PATH`: Override default config file path
- Example file: `.env.example`

## Database
- ORM: **MikroORM**
- Supported: PostgreSQL, SQLite, In-memory (for testing)
- In-memory SQLite: Used in test environment via `type: 'memory'` config
- Migrations stored in entities with decorators
- Seeders in `src/seeders/`

## MCP Tool Usage
- **Actively use MCP (Model Context Protocol) tools** for documentation and web searches
- Use `context7_resolve-library-id` and `context7_query-docs` for library documentation
- Use `zread_search_doc`, `zread_read_file`, `zread_get_repo_structure` for GitHub repositories
- Use `web-search-prime_webSearchPrime` for general web searches
- Prefer official documentation via MCP tools over guessing API usage
- Maximum 3 calls per tool per question - use best available information

## Post-Task Verification

**After completing any code changes, you MUST run the following three checks:**

### 1. Build Check
Ensure the project compiles without errors:
```bash
# From root directory
pnpm build
```

### 2. Test Check
Ensure all tests pass:
```bash
# From root directory (runs all package tests)
pnpm test

# Or run specific package tests
cd packages/backend && pnpm test
cd packages/frontend && pnpm test
```

### 3. Biome Check
Ensure code formatting and linting passes:
```bash
# From root directory
pnpm biome check .

# To auto-fix issues
pnpm biome check --write .
```

**Important:**
- All three checks must pass before considering the task complete
- Fix any errors or warnings before committing
- If a check fails, resolve the issues and re-run all checks

## General Best Practices
- Write descriptive commit messages
- Keep functions small and focused
- Use async/await (not callbacks)
- Validate all user input with Zod
- Type everything - avoid `any`
- Use descriptive variable names
- Comment complex business logic
- Follow DRY principles

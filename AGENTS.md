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
├── db/                    # Database configurations (sqlite, postgres, memory)
├── entities/              # MikroORM entity definitions
├── repositories/          # Custom repository classes
├── services/              # Business logic services
├── routes/                # HTTP route handlers
│   ├── api/v1/           # REST API endpoints
│   └── application/oauth/ # OAuth/OIDC endpoints
├── schemas/               # Zod validation schemas
├── plugins/               # Fastify plugins (auto-loaded)
├── lib/                   # Utility libraries
│   └── config/           # Configuration system
├── test-utils/            # Test utilities and helpers
└── seeders/               # Database seeders
```

### Frontend Directory Structure
```
packages/frontend/src/
├── components/            # React components (auth, modals/profile, profile, skeletons, ui)
├── hooks/                 # Custom React hooks
├── queries/               # TanStack Query options
├── routes/                # TanStack Router file-based routes
├── i18n/                  # Internationalization
└── libs/                  # Utility libraries
```

### Frontend E2E Tests Structure
```
packages/frontend/e2e/
├── fixtures/              # Test constants
├── utils/                 # Test helper functions
└── tests/                 # Playwright E2E tests (auth, oauth, profile)
```

## Build, Lint, and Test Commands

### Root Level
```bash
pnpm dev        # Start all packages in dev mode
pnpm build      # Build all packages
```

### Backend (packages/backend)
```bash
pnpm dev        # Development mode with hot reload
pnpm dev:test   # Dev mode with test environment
pnpm build      # Compile TypeScript
pnpm test       # Run all tests with Vitest
pnpm start      # Start production server
```

### Frontend (packages/frontend)
```bash
pnpm dev        # Build for development (watch mode)
pnpm build      # Build for production
pnpm preview    # Preview production build
```

### Running Single Tests
```bash
cd packages/backend && pnpm test src/routes/application/oauth/authorize/get.test.ts
```

## Code Style Guidelines

### Formatter and Linter
- Use **Biome** for formatting and linting (NOT Prettier/ESLint)
- Line width: 80 characters, 2 spaces indentation, single quotes

### Import Conventions
- Use path aliases: `@/` maps to `src/` directory
- Always include `.js` extension for local imports (ESM requirement)
- Group imports: external libraries first, then local imports
- **No barrel exports**: Import directly from the source file

### TypeScript Configuration
- **Strict mode enabled** with additional strict checks
- `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- `noImplicitReturns: true`, `noUnusedParameters: true`, `strictNullChecks: true`
- **No type assertions or non-null assertions** (`as`, `!`)

### Naming Conventions
- **Files**: kebab-case (e.g., `user.entity.ts`, `auth-page-layout.tsx`)
- **Classes**: PascalCase (e.g., `UserEntity`, `UserRepository`)
- **Functions/Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Database columns**: snake_case

### Module System
- Use **ESM modules** (not CommonJS)
- Module resolution: `nodenext`
- Always use `.js` extensions in imports for local files

### Backend-Specific Patterns

#### Zod Schema Validation
- **Always use Zod v4 API** for all schema definitions
- Schemas organized by purpose: `field.ts` (reusable fields), `response.ts` (responses), `error.ts` (errors), `provider.ts` (custom types)

#### File-Based Routing
Routes use `@fastify/autoload` with directory-to-URL mapping:
- **HTTP method = filename**: `get.ts`, `post.ts`, `put.ts`, `delete.ts`, `patch.ts`
- **Dynamic parameters**: Use underscore prefix (e.g., `_id/`)
- **Test files**: Colocated with route files (e.g., `post.test.ts`)

#### Entity Classes (MikroORM)
- Extend `BaseEntity` which provides `created_at` and `updated_at` fields
- UUID primary keys via `crypto.randomUUID()`
- Snake_case for database column names
- Use `t.*` type helpers for column types
- Lazy load sensitive fields with `lazy: true`
- Automatic password hashing in `@BeforeCreate`/`@BeforeUpdate` hooks

#### Services
Services are Fastify plugins that encapsulate business logic:
- Export a class with business logic methods
- Use `fastify-plugin` wrapper with module augmentation

#### Session Management
- Uses `@fastify/secure-session` with cookie-based sessions
- Access: `req.session.get('user')`, `req.session.set('user', data)`, `req.session.delete()`

#### Password Hashing
- Uses `argon2` for all password/secret hashing
- Automatic hashing in entity lifecycle hooks

#### JWT Token Management
- Uses `jose` library (NOT `jsonwebtoken`)
- **Algorithm: RS256 asymmetric keys**
- Automatic key generation and rotation
- Key lifecycle: `next` -> `active` -> `previous` -> `retired`
- JWKS endpoint: `/.well-known/jwks.json`

#### Testing (Vitest)
- Use `app.inject()` for testing HTTP endpoints
- Test utilities in `test-utils/`: `setupTestServer()`, `fixtures.ts`, `helpers.ts`, `oauth.ts`

### Frontend-Specific Patterns

#### React Components
- Functional components with hooks
- TanStack Router for routing with `createFileRoute`
- Daisy UI components (Tailwind V4 CSS-based)
- TanStack Query for data fetching
- Forms: React Hook Form with Zod validation
- Icons: **Phosphor Icons** (import with `Icon` suffix)

#### Build Configuration
- Frontend builds to `../backend/public/` directory
- Vite dev server proxies API requests to backend (port 8080)
- Production: Single server serves both frontend and backend

#### Internationalization (i18n)
- **Always use i18n** for all user-facing text
- Use `react-i18next` with `useTranslation` hook
- Translation files: `src/i18n/locales/{ko,en,ja}.json`
- Supported languages: Korean (ko), English (en), Japanese (ja)

#### State Management
- TanStack Query for server state
- Export reusable `queryOptions` and `mutationOptions` in `queries/` directory
- Use `tick()` utility to wait for state updates before navigation

#### HTTP Client (etch)
- Use `etch()` wrapper from `libs/etch.ts` for all HTTP requests
- Centralized error handling and JSON headers

#### Frontend Testing with Playwright
- Start dev server: `pnpm dev`
- Use MCP tools: `playwright_browser_navigate`, `playwright_browser_snapshot`, `playwright_browser_click`, `playwright_browser_fill_form`

#### E2E Testing with Playwright
- Tests in `packages/frontend/e2e/tests/`
- Run: `pnpm test:e2e` (headless), `pnpm test:e2e:ui` (interactive)
- Prerequisites: Both dev servers running (`pnpm dev`)

### Error Handling
- Centralized error definitions in `schemas/error.ts` using `createError` function
- Use `e` namespace: `throw new e.ErrorName.Error()`
- Schema: `response: { 401: e.ErrorName.Schema }`

## Configuration

### Backend Configuration
- Settings in `packages/backend/config.yaml`
- Config file location: Default `/opt/config.yaml`, override with `CONFIG_PATH`
- Test environment: Uses `DEFAULT_TEST_CONFIG` from `test-utils/setup.ts`
- YAML config supports `!env` tag for environment variables

### Config-based Data Source
- Users and OAuth clients defined in `config.yaml` are a **separate data source**
- Application searches **both** config and database
- Config-based data takes priority (checked first)
- Config entries marked with `managed_by: 'config'`, DB with `managed_by: 'database'`

## Database
- ORM: **MikroORM**
- Supported: PostgreSQL, SQLite, In-memory (for testing)
- In-memory SQLite used in test environment

## MCP Tool Usage
- Use `context7_resolve-library-id` and `context7_query-docs` for library documentation
- Prefer official documentation via MCP tools

## Post-Task Verification

After completing code changes, run:

```bash
pnpm build      # Build check
pnpm test       # Test check
pnpm biome check .  # Lint check
```

## General Best Practices
- Write descriptive commit messages
- Keep functions small and focused
- Use async/await (not callbacks)
- Validate all user input with Zod
- Type everything - avoid `any`
- Use descriptive variable names
- Comment complex business logic
- Follow DRY principles

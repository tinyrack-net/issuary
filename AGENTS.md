# Agent Development Guide

This document provides guidelines for AI coding agents working in the tinyauth repository.

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
- `packages/server` - Fastify-based OAuth2/OIDC authentication server
- `packages/frontend` - React frontend using TanStack Router and Daisy UI

Example applications for testing OIDC flows:
- `examples/clients/nextjs-ssr` - Next.js OIDC test client (server-side token handling)
- `examples/clients/react-spa` - React SPA OIDC test client (client-side PKCE flow)

## Build, Lint, and Test Commands

### Root Level
```bash
pnpm dev        # Start all packages in dev mode
pnpm build      # Build all packages
pnpm test       # Run all tests
```

## Code Style Guidelines

### Import Conventions
- Always include `.js` extension for local imports (ESM requirement)
- **No barrel exports**: Import directly from the source file (exception: `packages/server/src/lib/config/index.ts` serves as the public module boundary for `@tinyrack/tinyauth-server/config`)

### TypeScript Configuration
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

#### Internationalization (i18n)
- **Always use i18n** for all user-facing text
- Use `react-i18next` with `useTranslation` hook
- Translation files: `src/i18n/locales/{ko,en,ja}.json`

## Post-Task Verification

After completing code changes, run:

```bash
pnpm build      # Build check
pnpm test 2>&1 | tail -200  # Test check (use tail to avoid long output)
pnpm biome check .  # Lint check
```

**Note**: Tests take a long time (~20 min). Always pipe test output through `tail` to see only the summary.

## Backward Compatibility
- This project is under active development and **backward compatibility is not required**.
- Feel free to make breaking changes without maintaining legacy support.

## General Best Practices
- Write descriptive commit messages
- Keep functions small and focused
- Use async/await (not callbacks)
- Validate all user input with Zod
- Type everything - avoid `any`
- Use descriptive variable names
- Follow DRY principles

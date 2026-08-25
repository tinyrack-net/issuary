# Agent Development Guide

This document provides guidelines for AI coding agents working in the issuary repository.

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
pnpm verify:quick # Static checks, incremental types, and source tests
pnpm verify:full  # Clean build, all tests, dist checks, and full E2E
pnpm test         # Alias for verify:full
```

## Code Style Guidelines

### Import Conventions
- Always include `.js` extension for local imports (ESM requirement)
- **No barrel exports**: Import directly from the source file (exception: `packages/server/src/lib/config/index.ts` serves as the public module boundary for `@tinyrack/issuary-server/config`)

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

## Required Verification Workflow

1. During implementation, run the smallest directly affected test file or
   Playwright project first. Add or update a test for every behavior change.
2. Before handing work back, run `pnpm verify:quick` and `git diff --check`.
   This is the normal local gate; do not run the 20-minute full suite by
   default. After a Playwright version change or on a new machine, run
   `pnpm test:setup:browsers` once first.
3. Run `pnpm verify:full` only when the user explicitly requests complete local
   verification, merge-queue CI is unavailable, or a CI failure cannot be
   isolated with a focused command.
4. For frontend E2E, performance, and platform failures, reproduce the failing
   file, project, or smoke command before widening the run.
5. Workflow changes require the focused tools workflow-policy test and
   `actionlint` in addition to `pnpm verify:quick`.
6. Full E2E, coverage, Windows compatibility, Screen Lab snapshots, and the
   complete performance catalog are owned by merge-group CI. Never report a
   locally omitted gate as passed.
7. If a task includes merging, it is complete only after the merge-group run
   for that pull request passes `Quality Gate`.
8. Treat intermittent failures as defects. Reproduce and fix the mechanism;
   do not use retries, re-runs, sleeps, skipped tests, or reduced concurrency to
   obtain a green result.

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

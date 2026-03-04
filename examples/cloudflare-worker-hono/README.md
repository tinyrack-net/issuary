# Cloudflare Worker Hono Example

This example deploys `@tinyauth/backend` to Cloudflare Workers with Hono and
serves the existing TinyAuth frontend from `packages/backend/public`.

## Scope

- Runtime: Cloudflare Workers
- HTTP app: Hono
- Database: PostgreSQL only
- Frontend: built from `@tinyauth/frontend`
- SMTP: disabled in this example
- D1: not supported yet

## Prerequisites

- PostgreSQL database reachable from Cloudflare Workers
- Cloudflare account with Workers enabled
- `pnpm install`

## Local Development

1. Copy `.dev.vars.example` to `.dev.vars` and update the values.
2. Run `pnpm --filter @tinyauth/example-cloudflare-worker-hono dev`

The `dev` script rebuilds `@tinyauth/frontend` into `packages/backend/public`
before starting the Worker dev server. If you change frontend code while
working on the example, rerun the command or keep a separate
`pnpm --filter @tinyauth/frontend build --watch` process running.

## Required Variables

- `COOKIE_SECRET`: 32-byte hex string for session cookies
- `DATABASE_URL`: PostgreSQL connection string

Optional variables:

- `APP_HOST`
- `ALLOWED_SIGNUP_EMAILS`
- `USERS_JSON`
- `CLIENTS_JSON`
- `TERMS_JSON`
- `HTML_TITLE`
- `HTML_DESCRIPTION`
- `HTML_FAVICON_URL`
- `LOG_LEVEL`

## Build And Deploy

```bash
pnpm --filter @tinyauth/example-cloudflare-worker-hono build
pnpm --filter @tinyauth/example-cloudflare-worker-hono deploy
```

## Notes

- The Worker handles backend routes first and serves static frontend assets for
  everything else.
- HTML responses are interpolated at runtime for `TITLE`, `DESCRIPTION`, and
  `FAVICON_URL`.
- Unknown file-like requests such as `/missing.js` return `404` instead of the
  SPA shell.


# Cloudflare Hono D1 Example

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

## Configuration

All configuration values are hardcoded in `src/config.ts`. Edit that file
directly to change the database connection, secrets, or other settings.

## Local Development

Run `pnpm --filter @tinyauth-examples/cloudflare-hono-d1 dev`

The `dev` script rebuilds `@tinyauth/frontend` into `packages/backend/public`
before starting the Worker dev server. If you change frontend code while
working on the example, rerun the command or keep a separate
`pnpm --filter @tinyauth/frontend build --watch` process running.

## Build And Deploy

```bash
pnpm --filter @tinyauth-examples/cloudflare-hono-d1 build
pnpm --filter @tinyauth-examples/cloudflare-hono-d1 deploy
```

## Notes

- The Worker handles backend routes first and serves static frontend assets for
  everything else.
- HTML responses are interpolated at runtime for `TITLE`, `DESCRIPTION`, and
  `FAVICON_URL`.
- Unknown file-like requests such as `/missing.js` return `404` instead of the
  SPA shell.

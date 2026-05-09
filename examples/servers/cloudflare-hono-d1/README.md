# Cloudflare Hono D1 Example

This example runs `@tinyrack/tinyauth-server` in library mode on Cloudflare Workers with
Hono, D1, and the bundled TinyAuth frontend assets.

## Scope

- Runtime: Cloudflare Workers
- HTTP app: Hono
- Database: Cloudflare D1
- Frontend: built from `@tinyrack/tinyauth-frontend` into `packages/server/public`
- Auth: self-signup enabled, no seeded users, no SMTP

## Prerequisites

- Cloudflare D1 database bound as `DB`
- Cloudflare account with Workers enabled
- `pnpm install`
- `pnpm --filter @tinyrack/tinyauth-frontend build`

## Configuration

The Worker builds its TinyAuth runtime config directly in
`src/index.ts` using the current backend option shape:

- `server.public_origin` uses `PUBLIC_ORIGIN`, with request-origin fallback for
  local development
- `PUBLIC_ORIGIN` can pin the canonical production origin and should be set
  before deployment
- `registration` enables open self-signup for local testing
- `database` uses `d1({ database: env.DB })`
- `frontend` uses `createCloudflareAssetsHandler()` from
  `@tinyrack/tinyauth-server/frontend/cloudflare`
- D1 migrations are applied by TinyAuth through MikroORM during startup

Replace the demo secrets before deploying anywhere outside development.

## Local Development

Run `pnpm --filter @tinyauth-server-examples/cloudflare-hono-d1 dev`

If you change frontend code while working on the example, rerun
`pnpm --filter @tinyrack/tinyauth-frontend build` or keep a separate
`pnpm --filter @tinyrack/tinyauth-frontend build --watch` process running.

## Build And Deploy

```bash
pnpm --filter @tinyauth-server-examples/cloudflare-hono-d1 build
pnpm --filter @tinyauth-server-examples/cloudflare-hono-d1 deploy
```

## Notes

- The Worker handles backend routes first and serves static frontend assets for
  everything else.
- The example uses `PUBLIC_ORIGIN` for redirects, cookies, and CORS. When it is
  omitted, local development falls back to the request origin.
- D1 schema migration is handled by the TinyAuth D1 adapter through MikroORM,
  not by Wrangler SQL migrations.
- The Worker caches TinyAuth initialization per isolate so MikroORM, services,
  and config seeding are not rebuilt on every request.
- HTML responses are interpolated at runtime for `TITLE`, `DESCRIPTION`, and
  `FAVICON_URL`.
- Unknown file-like requests such as `/missing.js` return `404` instead of the
  SPA shell.
- This example is not production-safe as written.

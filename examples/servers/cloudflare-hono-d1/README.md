# Cloudflare Hono D1 Example

This example runs `@tinyauth/backend` in library mode on Cloudflare Workers with
Hono, D1, and the bundled TinyAuth frontend assets.

## Scope

- Runtime: Cloudflare Workers
- HTTP app: Hono
- Database: Cloudflare D1
- Frontend: built from `@tinyauth/frontend` into `packages/backend/public`
- Auth: self-signup enabled, no seeded users, no SMTP

## Prerequisites

- Cloudflare D1 database bound as `DB`
- Cloudflare account with Workers enabled
- `pnpm install`
- `pnpm --filter @tinyauth/frontend build`

## Configuration

The Worker builds its TinyAuth runtime config directly in
`src/index.ts` using the current backend option shape:

- `server.public_origin` is derived from each incoming request
- `registration` enables open self-signup for local testing
- `database` uses `d1({ database: env.DB })`
- `frontend` uses `createCloudflareAssetsHandler()` from
  `@tinyauth/backend/frontend/cloudflare`

Replace the demo secrets before deploying anywhere outside development.

## Local Development

Run `pnpm --filter @tinyauth-server-examples/cloudflare-hono-d1 dev`

If you change frontend code while working on the example, rerun
`pnpm --filter @tinyauth/frontend build` or keep a separate
`pnpm --filter @tinyauth/frontend build --watch` process running.

## Build And Deploy

```bash
pnpm --filter @tinyauth-server-examples/cloudflare-hono-d1 build
pnpm --filter @tinyauth-server-examples/cloudflare-hono-d1 deploy
```

## Notes

- The Worker handles backend routes first and serves static frontend assets for
  everything else.
- The example sets `server.public_origin` from the request origin so redirects,
  cookies, and CORS match the Worker hostname.
- HTML responses are interpolated at runtime for `TITLE`, `DESCRIPTION`, and
  `FAVICON_URL`.
- Unknown file-like requests such as `/missing.js` return `404` instead of the
  SPA shell.
- This example is not production-safe as written.

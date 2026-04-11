# Homepage

This package contains the Astro-based Tinyauth homepage and documentation site.

## Scope

- Runtime: static assets on Cloudflare Workers
- Site generator: Astro with Starlight
- Build output: `dist/`
- API reference source: generated into `public/openapi.json`

## Prerequisites

- `pnpm install`
- Cloudflare account with Workers enabled
- `wrangler login`

## Configuration

Cloudflare deployment is configured in `wrangler.jsonc`.

- Update `name` before the first deploy if you do not want to use the default Worker name.
- Add custom domains or routes in `wrangler.jsonc` or the Cloudflare dashboard if needed.

## GitHub Actions

The repository deploy workflow lives at `.github/workflows/deploy-homepage.yml`.

Set these repository secrets before enabling automatic deploys from `main`:

- `CLOUDFLARE_API_TOKEN`: API token with permission to deploy Workers.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID for the target Worker.

## Local Development

Use Astro for content and layout work:

```bash
pnpm --filter @tinyrack/tinyauth-homepage dev
```

Use Wrangler to preview the built static bundle exactly as Cloudflare Workers will serve it:

```bash
pnpm --filter @tinyrack/tinyauth-homepage preview:worker
```

## Build And Deploy

```bash
pnpm --filter @tinyrack/tinyauth-homepage build
pnpm --filter @tinyrack/tinyauth-homepage deploy
```

To validate the Worker packaging without publishing:

```bash
pnpm --filter @tinyrack/tinyauth-homepage deploy:dry-run
```

## Notes

- The deploy path is static-only. No Worker `main` entrypoint is required.
- `404.html` from Astro is served through Cloudflare's `404-page` handling.
- `preview:worker` and `deploy` rebuild the site before invoking Wrangler so the published assets stay in sync.

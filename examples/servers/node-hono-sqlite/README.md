# Node Hono SQLite Example

This example runs `@tinyrack/issuary-server` in library mode on Node.js with Hono,
`@hono/node-server`, SQLite, and the bundled Issuary frontend.

## Scope

- Runtime: Node.js
- HTTP app: Hono
- Database: local SQLite file at `examples/servers/node-hono-sqlite/data/issuary.db`
- Frontend: bundled React Router SSR build served by the Hono process
- Auth: self-signup enabled, no seeded users, no SMTP

## Run

```bash
pnpm --filter @issuary-server-examples/node-hono-sqlite dev
```

Then open `http://localhost:8080`.

The `dev` and `start` scripts build `@tinyrack/issuary-frontend` first, so the bundled
UI is available without an extra manual step.

## Scheduler

Library mode keeps the scheduler explicit. Omit `scheduler` to disable it, or
enable it with:

```ts
import { croner } from '@tinyrack/issuary-server/scheduler/croner';

await createApp({
  scheduler: croner({ cleanupCron: '0 2 * * *' }),
});
```

## Notes

- This example is intentionally minimal and uses hardcoded demo secrets.
- Signup is open to any email address for local testing.
- If you change frontend code, rerun the example command or run
  `pnpm --filter @tinyrack/issuary-frontend build` separately.
- This example is not production-safe.

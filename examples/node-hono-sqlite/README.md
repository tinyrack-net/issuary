# Node Hono SQLite Example

This example runs `@tinyauth/backend` in library mode on Node.js with Hono,
`@hono/node-server`, SQLite, and the bundled TinyAuth frontend.

## Scope

- Runtime: Node.js
- HTTP app: Hono
- Database: local SQLite file at `examples/node-hono-sqlite/data/tinyauth.db`
- Frontend: built from `@tinyauth/frontend` into `packages/backend/public`
- Auth: self-signup enabled, no seeded users, no SMTP

## Run

```bash
pnpm --filter @tinyauth/example-node-hono-sqlite dev
```

Then open `http://localhost:8080`.

The `dev` and `start` scripts build `@tinyauth/frontend` first, so the bundled
UI is available without an extra manual step.

## Scheduler

Library mode keeps the scheduler explicit. Omit `scheduler` to disable it, or
enable it with:

```ts
import { croner } from '@tinyauth/backend/scheduler/croner';

await createApp({
  config: {
    scheduler: croner({ cron: '0 2 * * *' }),
  },
});
```

## Notes

- This example is intentionally minimal and uses hardcoded demo secrets.
- Signup is open to any email address for local testing.
- If you change frontend code, rerun the example command or run
  `pnpm --filter @tinyauth/frontend build` separately.
- This example is not production-safe.

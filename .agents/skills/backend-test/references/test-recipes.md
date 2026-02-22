# Backend Test Recipes

## Minimal Route Test Setup

```ts
import type { AppType } from '@backend/app.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import { MINIMAL_TEST_CONFIG } from '@backend/test-utils/index.js';
import { afterAll, beforeAll } from 'vitest';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ app, services, cleanup } = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
    },
  }));
});

afterAll(async () => {
  await cleanup();
});
```

## Assert Typed JSON Responses

```ts
import { assertJsonBody } from '@backend/test-utils/index.js';

const body = await assertJsonBody(res);
const errorBody = await assertJsonBody(res, 401);
```

Use `assertJsonBody` instead of `await res.json()` directly so status
expectations and response typing stay aligned.

## Authenticated Session Requests

```ts
import {
  createAuthenticatedSession,
  createDbUserWithSession,
} from '@backend/test-utils/index.js';

const sessionCookie = await createAuthenticatedSession(app);

const res = await client.api.user.session.$get(
  {},
  { headers: { Cookie: `session=${sessionCookie}` } },
);
```

Use `createDbUserWithSession` when the scenario requires
database-managed users instead of config-defined users.

## Redirect Assertions

```ts
import { getLocationHeader } from '@backend/test-utils/index.js';

const location = new URL(getLocationHeader(res), 'http://localhost:8080');
expect(location.pathname).toBe('/login');
```

Do not compare raw header strings when query param ordering may vary.

## OAuth Flow Helper Usage

```ts
import {
  exchangeCodeForTokens,
  getAuthorizationCode,
  introspectToken,
} from '@backend/test-utils/index.js';

const { code } = await getAuthorizationCode(app, {
  sessionCookie,
});

const tokenRes = await exchangeCodeForTokens(app, { code });
const tokenBody = await assertJsonBody(tokenRes);

const introspectRes = await introspectToken(app, {
  token: tokenBody.access_token,
});
```

Prefer helper-based flow assembly for readability and protocol
correctness.

## DB Mutation Pattern

```ts
import { withMikroContext } from '@backend/test-utils/index.js';

await withMikroContext(services, async () => {
  const user = await services.mikro.user.findOneOrFail({
    email: targetEmail,
  });
  user.email_verified = true;
  await services.mikro.em.flush();
});
```

Use `withMikroContext` for direct entity setup and state mutations
inside tests.

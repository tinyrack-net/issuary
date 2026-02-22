import { createRegistrationDisabledConfig } from '@frontend-e2e/configs/registration-disabled.js';
import { createE2EServer } from '@frontend-e2e/setup/create-server.js';
import { test as base } from '@playwright/test';

export const test = base.extend<object, { serverPort: number }>({
  serverPort: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring
    async ({}, use) => {
      const server = await createE2EServer(createRegistrationDisabledConfig);
      await use(server.backendPort);
      await server.teardown();
    },
    { scope: 'worker' },
  ],
  baseURL: async ({ serverPort }, use) => {
    await use(`http://localhost:${serverPort}`);
  },
});

export { expect } from '@playwright/test';

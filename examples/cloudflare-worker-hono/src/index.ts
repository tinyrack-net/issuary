import type { AppType } from '@tinyauth/backend';
import { createCloudflareExampleApp } from './app.js';
import type { CloudflareExampleEnv } from './config.js';

type AppExecutionContext = Parameters<AppType['fetch']>[2];

let appPromise: ReturnType<typeof createCloudflareExampleApp> | undefined;

async function getApp(env: CloudflareExampleEnv) {
  if (!appPromise) {
    appPromise = createCloudflareExampleApp(env).catch((error: unknown) => {
      appPromise = undefined;
      throw error;
    });
  }

  return appPromise;
}

const worker = {
  async fetch(
    request: Request,
    env: CloudflareExampleEnv,
    executionContext: AppExecutionContext,
  ) {
    const app = await getApp(env);
    return app.fetch(request, env, executionContext);
  },
};

export default worker;
export { createCloudflareExampleApp };
export type { CloudflareExampleEnv };

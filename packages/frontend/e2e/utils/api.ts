import type { AppType } from '@backend/rpc.ts';
import { hc } from 'hono/client';

export const createApiClient = (options: {
  baseUrl: string
}) => hc<AppType>(options.baseUrl, {});


import { hc } from 'hono/client';
import type { TestHonoApp } from './create-server';

export const getTestApiClient = (options: { baseUrl: string }) =>
  hc<TestHonoApp>(options.baseUrl, {});

import { Hono } from 'hono';
import type { AppEnv } from '#server/lib/app-env.js';
import { openidConfigGet } from './openid-configuration/get.js';

export const wellKnownRoutes = new Hono<AppEnv>().route('/', openidConfigGet);

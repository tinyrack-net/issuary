import { Hono } from 'hono';
import type { AppEnv } from '#backend/lib/app-env.js';
import { docsGet } from './get.js';

export const docsRoutes = new Hono<AppEnv>().route('/', docsGet);

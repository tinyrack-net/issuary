import type { AppEnv } from '@backend/lib/app-env.js';
import { Hono } from 'hono';
import { docsGet } from './get.js';

export const docsRoutes = new Hono<AppEnv>().route('/', docsGet);

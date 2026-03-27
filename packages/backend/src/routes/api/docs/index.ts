import { Hono } from 'hono';
import type { AppEnv } from '../../../lib/app-env.ts';
import { docsGet } from './get.ts';

export const docsRoutes = new Hono<AppEnv>().route('/', docsGet);

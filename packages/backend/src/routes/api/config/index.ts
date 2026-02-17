import type { AppEnv } from '@backend/lib/app-env.js';
import { Hono } from 'hono';
import { configGet } from './get.js';

export const configRoutes = new Hono<AppEnv>().route('/', configGet);

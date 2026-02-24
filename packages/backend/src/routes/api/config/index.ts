import { Hono } from 'hono';
import type { AppEnv } from '#backend/lib/app-env.js';
import { configGet } from './get.js';

export const configRoutes = new Hono<AppEnv>().route('/', configGet);

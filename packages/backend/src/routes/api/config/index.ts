import { Hono } from 'hono';
import type { AppEnv } from '../../../lib/app-env.ts';
import { configGet } from './get.ts';

export const configRoutes = new Hono<AppEnv>().route('/', configGet);

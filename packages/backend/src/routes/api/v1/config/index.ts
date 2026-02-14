import { createRouter } from '@backend/lib/create-router.js';
import { configGet } from './get.js';

export const configRoutes = createRouter().route('/', configGet);

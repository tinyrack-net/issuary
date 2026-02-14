import { createRouter } from '@backend/lib/create-router.js';
import { docsGet } from './get.js';

export const docsRoutes = createRouter().route('/', docsGet);

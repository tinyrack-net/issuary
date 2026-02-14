import { createRouter } from '@backend/lib/create-router.js';
import { openidConfigGet } from './openid-configuration/get.js';

export const wellKnownRoutes = createRouter().route('/', openidConfigGet);

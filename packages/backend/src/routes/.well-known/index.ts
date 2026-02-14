import { createRouter } from '@backend/lib/create-router.js';
import openidConfigGet from './openid-configuration/get.js';

const app = createRouter().route('/', openidConfigGet);

export default app;

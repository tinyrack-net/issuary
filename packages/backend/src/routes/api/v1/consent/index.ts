import { createRouter } from '@backend/lib/create-router.js';
import { consentGet } from './get.js';
import { consentPost } from './post.js';

export const consentRoutes = createRouter()
  .route('/', consentGet)
  .route('/', consentPost);

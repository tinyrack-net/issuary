import { createRouter } from '@backend/lib/create-router.js';
import { termsConsentPost } from './consent/post.js';
import { termsGet } from './get.js';

export const termsRoutes = createRouter()
  .route('/', termsGet)
  .route('/', termsConsentPost);

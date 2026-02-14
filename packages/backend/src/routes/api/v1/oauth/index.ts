import { createRouter } from '@backend/lib/create-router.js';
import { oauthProviderAuthorizeGet } from './_provider/authorize/get.js';
import { oauthProviderCallbackGet } from './_provider/callback/get.js';
import { oauthProviderDelete } from './_provider/delete.js';

export const oauthRoutes = createRouter()
  .route('/', oauthProviderAuthorizeGet)
  .route('/', oauthProviderCallbackGet)
  .route('/', oauthProviderDelete);

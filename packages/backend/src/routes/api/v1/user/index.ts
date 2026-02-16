import type { AppEnv } from '@backend/lib/app-env.js';
import { Hono } from 'hono';
import { userDelete } from './delete.js';
import { userOauthAccountsGet } from './oauth-accounts/get.js';
import { userPasskeyIdDelete } from './passkeys/_id/delete.js';
import { userPasskeyIdPatch } from './passkeys/_id/patch.js';
import { userPasskeysGet } from './passkeys/get.js';
import { userPasskeyRegisterOptionsPost } from './passkeys/register/options/post.js';
import { userPasskeyRegisterVerifyPost } from './passkeys/register/verify/post.js';
import { userPasswordDelete } from './password/delete.js';
import { userPasswordPost } from './password/post.js';
import { userPasswordPut } from './password/put.js';
import { userSessionGet } from './session/get.js';
import { userTotpConfirmPost } from './totp/confirm/post.js';
import { userTotpDelete } from './totp/delete.js';
import { userTotpSetupPost } from './totp/setup/post.js';
import { userTotpVerifyPost } from './totp/verify/post.js';

export const userRoutes = new Hono<AppEnv>()
  .route('/', userDelete)
  .route('/', userSessionGet)
  .route('/', userPasswordPost)
  .route('/', userPasswordPut)
  .route('/', userPasswordDelete)
  .route('/', userOauthAccountsGet)
  .route('/', userTotpSetupPost)
  .route('/', userTotpVerifyPost)
  .route('/', userTotpConfirmPost)
  .route('/', userTotpDelete)
  .route('/', userPasskeysGet)
  .route('/', userPasskeyIdDelete)
  .route('/', userPasskeyIdPatch)
  .route('/', userPasskeyRegisterOptionsPost)
  .route('/', userPasskeyRegisterVerifyPost);

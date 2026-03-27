import { Hono } from 'hono';
import type { AppEnv } from '../../../lib/app-env.ts';
import { userDelete } from './delete.ts';
import { userOauthAccountsGet } from './oauth-accounts/get.ts';
import { userPasskeyIdDelete } from './passkeys/_id/delete.ts';
import { userPasskeyIdPatch } from './passkeys/_id/patch.ts';
import { userPasskeysGet } from './passkeys/get.ts';
import { userPasskeyRegisterOptionsPost } from './passkeys/register/options/post.ts';
import { userPasskeyRegisterVerifyPost } from './passkeys/register/verify/post.ts';
import { userPasswordDelete } from './password/delete.ts';
import { userPasswordPost } from './password/post.ts';
import { userPasswordPut } from './password/put.ts';
import { userSessionGet } from './session/get.ts';
import { userTotpConfirmPost } from './totp/confirm/post.ts';
import { userTotpDelete } from './totp/delete.ts';
import { userTotpRecoveryRegeneratePost } from './totp/recovery/regenerate/post.ts';
import { userTotpSetupPost } from './totp/setup/post.ts';
import { userTotpVerifyPost } from './totp/verify/post.ts';

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
  .route('/', userTotpRecoveryRegeneratePost)
  .route('/', userTotpDelete)
  .route('/', userPasskeysGet)
  .route('/', userPasskeyIdDelete)
  .route('/', userPasskeyIdPatch)
  .route('/', userPasskeyRegisterOptionsPost)
  .route('/', userPasskeyRegisterVerifyPost);

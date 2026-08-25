import { Hono } from 'hono';
import type { AppEnv } from '../../../lib/app-env.ts';
import { authSecondFactorMethodsGet } from './2fa/methods/get.ts';
import { authAccountsGet } from './accounts/get.ts';
import { authAccountsRemovePost } from './accounts/remove.post.ts';
import { authAccountsSelectPost } from './accounts/select.post.ts';
import { authEmailResendPost } from './email/resend/post.ts';
import { authEmailVerifyPost } from './email/verify/post.ts';
import { authLoginPost } from './login/post.ts';
import { authLogoutPost } from './logout/post.ts';
import { authPasskeyOptionsPost } from './passkey/options/post.ts';
import { authPasskeyVerifyPost } from './passkey/verify/post.ts';
import { authPasswordForgotPost } from './password/forgot/post.ts';
import { authPasswordResetPost } from './password/reset/post.ts';
import { authPasswordResetRequiredPost } from './password/reset-required/post.ts';
import { authRegisterPost } from './register/post.ts';
import { authTotpRecoveryVerifyPost } from './totp/recovery/verify/post.ts';
import { authTotpVerifyPost } from './totp/verify/post.ts';

export const authRoutes = new Hono<AppEnv>()
  .route('/', authAccountsGet)
  .route('/', authAccountsSelectPost)
  .route('/', authAccountsRemovePost)
  .route('/', authSecondFactorMethodsGet)
  .route('/', authLoginPost)
  .route('/', authLogoutPost)
  .route('/', authRegisterPost)
  .route('/', authPasswordForgotPost)
  .route('/', authPasswordResetPost)
  .route('/', authPasswordResetRequiredPost)
  .route('/', authEmailVerifyPost)
  .route('/', authEmailResendPost)
  .route('/', authTotpVerifyPost)
  .route('/', authTotpRecoveryVerifyPost)
  .route('/', authPasskeyOptionsPost)
  .route('/', authPasskeyVerifyPost);

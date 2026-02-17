import type { AppEnv } from '@backend/lib/app-env.js';
import { Hono } from 'hono';
import { authEmailResendPost } from './email/resend/post.js';
import { authEmailVerifyPost } from './email/verify/post.js';
import { authLoginPost } from './login/post.js';
import { authLogoutPost } from './logout/post.js';
import { authPasskeyOptionsPost } from './passkey/options/post.js';
import { authPasskeyVerifyPost } from './passkey/verify/post.js';
import { authPasswordForgotPost } from './password/forgot/post.js';
import { authPasswordResetPost } from './password/reset/post.js';
import { authRegisterPost } from './register/post.js';
import { authTotpRecoveryVerifyPost } from './totp/recovery/verify/post.js';
import { authTotpVerifyPost } from './totp/verify/post.js';

export const authRoutes = new Hono<AppEnv>()
  .route('/', authLoginPost)
  .route('/', authLogoutPost)
  .route('/', authRegisterPost)
  .route('/', authPasswordForgotPost)
  .route('/', authPasswordResetPost)
  .route('/', authEmailVerifyPost)
  .route('/', authEmailResendPost)
  .route('/', authTotpVerifyPost)
  .route('/', authTotpRecoveryVerifyPost)
  .route('/', authPasskeyOptionsPost)
  .route('/', authPasskeyVerifyPost);

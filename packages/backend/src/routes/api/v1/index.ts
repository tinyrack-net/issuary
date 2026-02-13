import { createRouter } from '@/lib/create-router.js';
import type { AppType } from '@/types.js';
import authEmailResendPost from './auth/email/resend/post.js';
import authEmailVerifyPost from './auth/email/verify/post.js';
// Auth
import authLoginPost from './auth/login/post.js';
import authLogoutPost from './auth/logout/post.js';
import authPasskeyOptionsPost from './auth/passkey/options/post.js';
import authPasskeyVerifyPost from './auth/passkey/verify/post.js';
import authPasswordForgotPost from './auth/password/forgot/post.js';
import authPasswordResetPost from './auth/password/reset/post.js';
import authRegisterPost from './auth/register/post.js';
import authTotpRecoveryVerifyPost from './auth/totp/recovery/verify/post.js';
import authTotpVerifyPost from './auth/totp/verify/post.js';
// Config
import configGet from './config/get.js';
// Consent
import consentGet from './consent/get.js';
import consentPost from './consent/post.js';
// Health
import healthGet from './health/get.js';
import healthLiveGet from './health/live/get.js';
import healthReadyGet from './health/ready/get.js';
// OAuth Connect
import oauthProviderAuthorizeGet from './oauth/_provider/authorize/get.js';
import oauthProviderCallbackGet from './oauth/_provider/callback/get.js';
import oauthProviderDelete from './oauth/_provider/delete.js';
import termsConsentPost from './terms/consent/post.js';
// Terms
import termsGet from './terms/get.js';
// User
import userDelete from './user/delete.js';
import userOauthAccountsGet from './user/oauth-accounts/get.js';
import userPasskeyIdDelete from './user/passkeys/_id/delete.js';
import userPasskeyIdPatch from './user/passkeys/_id/patch.js';
import userPasskeysGet from './user/passkeys/get.js';
import userPasskeyRegisterOptionsPost from './user/passkeys/register/options/post.js';
import userPasskeyRegisterVerifyPost from './user/passkeys/register/verify/post.js';
import userPasswordDelete from './user/password/delete.js';
import userPasswordPost from './user/password/post.js';
import userPasswordPut from './user/password/put.js';
import userSessionGet from './user/session/get.js';
import userTotpConfirmPost from './user/totp/confirm/post.js';
import userTotpDelete from './user/totp/delete.js';
import userTotpSetupPost from './user/totp/setup/post.js';
import userTotpVerifyPost from './user/totp/verify/post.js';

export function registerApiV1Routes(parentApp: AppType): void {
  const app = createRouter();
  // Auth
  authLoginPost(app);
  authLogoutPost(app);
  authRegisterPost(app);
  authPasswordForgotPost(app);
  authPasswordResetPost(app);
  authEmailVerifyPost(app);
  authEmailResendPost(app);
  authTotpVerifyPost(app);
  authTotpRecoveryVerifyPost(app);
  authPasskeyOptionsPost(app);
  authPasskeyVerifyPost(app);
  // Config
  configGet(app);
  // Consent
  consentGet(app);
  consentPost(app);
  // Health
  healthGet(app);
  healthReadyGet(app);
  healthLiveGet(app);
  // Terms
  termsGet(app);
  termsConsentPost(app);
  // User
  userDelete(app);
  userSessionGet(app);
  userPasswordPost(app);
  userPasswordPut(app);
  userPasswordDelete(app);
  userOauthAccountsGet(app);
  userTotpSetupPost(app);
  userTotpVerifyPost(app);
  userTotpConfirmPost(app);
  userTotpDelete(app);
  userPasskeysGet(app);
  userPasskeyIdDelete(app);
  userPasskeyIdPatch(app);
  userPasskeyRegisterOptionsPost(app);
  userPasskeyRegisterVerifyPost(app);
  // OAuth Connect
  oauthProviderAuthorizeGet(app);
  oauthProviderCallbackGet(app);
  oauthProviderDelete(app);
  parentApp.route('/api/v1', app);
}

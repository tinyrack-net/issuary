import type { FastifyPluginAsync } from 'fastify';
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

export const registerApiV1Routes: FastifyPluginAsync = async (fastify) => {
  // Auth
  await fastify.register(authLoginPost);
  await fastify.register(authLogoutPost);
  await fastify.register(authRegisterPost);
  await fastify.register(authPasswordForgotPost);
  await fastify.register(authPasswordResetPost);
  await fastify.register(authEmailVerifyPost);
  await fastify.register(authEmailResendPost);
  await fastify.register(authTotpVerifyPost);
  await fastify.register(authTotpRecoveryVerifyPost);
  await fastify.register(authPasskeyOptionsPost);
  await fastify.register(authPasskeyVerifyPost);
  // Config
  await fastify.register(configGet);
  // Consent
  await fastify.register(consentGet);
  await fastify.register(consentPost);
  // Health
  await fastify.register(healthGet);
  await fastify.register(healthReadyGet);
  await fastify.register(healthLiveGet);
  // Terms
  await fastify.register(termsGet);
  await fastify.register(termsConsentPost);
  // User
  await fastify.register(userDelete);
  await fastify.register(userSessionGet);
  await fastify.register(userPasswordPost);
  await fastify.register(userPasswordPut);
  await fastify.register(userPasswordDelete);
  await fastify.register(userOauthAccountsGet);
  await fastify.register(userTotpSetupPost);
  await fastify.register(userTotpVerifyPost);
  await fastify.register(userTotpConfirmPost);
  await fastify.register(userTotpDelete);
  await fastify.register(userPasskeysGet);
  await fastify.register(userPasskeyIdDelete);
  await fastify.register(userPasskeyIdPatch);
  await fastify.register(userPasskeyRegisterOptionsPost);
  await fastify.register(userPasskeyRegisterVerifyPost);
  // OAuth Connect
  await fastify.register(oauthProviderAuthorizeGet);
  await fastify.register(oauthProviderCallbackGet);
  await fastify.register(oauthProviderDelete);
};

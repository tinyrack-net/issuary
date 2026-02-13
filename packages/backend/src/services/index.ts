import type { FastifyInstance } from 'fastify';
import baseServicePlugin from './base.service.js';
import cleanupServicePlugin from './cleanup.service.js';
import emailServicePlugin from './email.service.js';
import emailVerificationServicePlugin from './email-verification.service.js';
import jwtServicePlugin from './jwt.service.js';
import oauthAuthorizeServicePlugin from './oauth-authorize.service.js';
import oauthClientServicePlugin from './oauth-client.service.js';
import oauthConnectServicePlugin from './oauth-connect.service.js';
import oauthTokenServicePlugin from './oauth-token.service.js';
import passkeyServicePlugin from './passkey.service.js';
import passwordResetServicePlugin from './password-reset.service.js';
import termsServicePlugin from './terms.service.js';
import totpServicePlugin from './totp.service.js';
import userServicePlugin from './user.service.js';
import userConsentServicePlugin from './user-consent.service.js';

export async function registerServices(
  fastify: FastifyInstance,
): Promise<void> {
  // No dependencies
  await fastify.register(baseServicePlugin);
  await fastify.register(emailServicePlugin);
  await fastify.register(emailVerificationServicePlugin);
  await fastify.register(jwtServicePlugin);
  await fastify.register(passwordResetServicePlugin);

  // Depends on base-service-plugin
  await fastify.register(termsServicePlugin);
  await fastify.register(userConsentServicePlugin);
  await fastify.register(oauthClientServicePlugin);
  await fastify.register(totpServicePlugin);
  await fastify.register(passkeyServicePlugin);

  // Multiple dependencies
  await fastify.register(userServicePlugin);
  await fastify.register(oauthAuthorizeServicePlugin);
  await fastify.register(oauthConnectServicePlugin);
  await fastify.register(oauthTokenServicePlugin);
  await fastify.register(cleanupServicePlugin);
}

import type { FastifyPluginAsync } from 'fastify';
import jwksGet from './.well-known/jwks/get.js';
import oidcConfigGet from './.well-known/openid-configuration/get.js';
import authorizeGet from './authorize/get.js';
import introspectPost from './introspect/post.js';
import revokePost from './revoke/post.js';
import tokenPost from './token/post.js';
import userinfoGet from './userinfo/get.js';

export const registerOAuthRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(authorizeGet);
  await fastify.register(tokenPost);
  await fastify.register(introspectPost);
  await fastify.register(revokePost);
  await fastify.register(userinfoGet);
  await fastify.register(jwksGet);
  await fastify.register(oidcConfigGet);
};

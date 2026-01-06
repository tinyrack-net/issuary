import { randomBytes } from 'node:crypto';
import { URL } from 'node:url';
import z from 'zod/v4';
import { validateProvider } from '@/handlers/validate-provider.js';
import { AppConfigs } from '@/lib/config.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Authorize',
      description: 'OAuth2 Authorization Endpoint',
      tags: ['OpenID'],
      querystring: z.object({
        response_type: z.string().min(1).max(100),
        redirect_uri: z.string().min(1).max(1000),
        state: z.string().min(1).max(1000).optional(),
        client_id: z.string().min(1).max(1000),
        code_challenge: z.string().min(1).max(1000).optional(),
        code_challenge_method: z.string().min(1).max(100).optional(),
        scope: z.string().min(1).max(1000).optional(),
      }),
      response: {
        302: z.null(),
        400: z.object({
          error: z.string(),
          error_description: z.string(),
        }),
      },
    },
    handler: async (req, res) => {
      const user = req.session.get('user')
      const provider = await validateProvider(req.query.client_id);

      const {
        response_type,
        redirect_uri,
        state,
        client_id,
        scope,
        code_challenge,
        code_challenge_method = 'S256',
      } = req.query;

      if (client_id && client_id !== provider.client_id) {
        return res.status(400).send({
          error: 'unauthorized_client',
          error_description: 'client_id does not match configured provider',
        });
      }

      if (!provider.redirect_uris.includes(redirect_uri)) {
        return res.status(400).send({
          error: 'invalid_request',
          error_description: 'redirect_uri is not registered for this provider',
        });
      }

      if (!provider.response_types.includes(response_type)) {
        return res.status(400).send({
          error: 'unsupported_response_type',
          error_description: 'response_type is not allowed for this provider',
        });
      }

      if (response_type !== 'code') {
        return res.status(400).send({
          error: 'unsupported_response_type',
          error_description:
            'Only authorization_code flow is supported for now',
        });
      }

      if (!provider.grant_types.includes('authorization_code')) {
        return res.status(400).send({
          error: 'unauthorized_client',
          error_description: 'authorization_code grant is not enabled',
        });
      }

      if (!code_challenge) {
        return res.status(400).send({
          error: 'invalid_request',
          error_description: 'code_challenge is required for PKCE',
        });
      }

      if (!['S256', 'plain'].includes(code_challenge_method)) {
        return res.status(400).send({
          error: 'invalid_request',
          error_description: 'code_challenge_method must be S256 or plain',
        });
      }

      // Issue a short-lived authorization code. Persisting the code is out of scope for this template.
      const authorizationCode = randomBytes(32).toString('base64url');

      // 로그인 상태에 따라 리다이렉트 처리
      if (user) {
        const url = new URL(redirect_uri);
        url.searchParams.set('code', authorizationCode);
        if (state) url.searchParams.set('state', state);
        if (scope) url.searchParams.set('scope', scope);
        return res.status(302).redirect(url.toString())
      } else {
        const url = new URL(AppConfigs.app.host);
        return res.status(302).redirect(url.toString())
      }
      // const redirect = new URL(redirect_uri);
      // redirect.searchParams.set('code', authorizationCode);
      // if (state) redirect.searchParams.set('state', state);
      // if (scope) redirect.searchParams.set('scope', scope);
      // res.redirect(redirect.toString(), 302);
    },
  });
};

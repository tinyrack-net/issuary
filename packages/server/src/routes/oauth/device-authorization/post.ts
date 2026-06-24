import { Hono } from 'hono';
import { describeRoute, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../lib/app-env.js';
import { getRandomBytes, toBase64Url } from '../../../lib/base64url.js';
import { TAGS } from '../../../lib/swagger-tags.js';
import { f } from '../../../schemas/field.js';
import {
  parseBasicClientCredentials,
  setBasicClientAuthChallengeIfInvalidClientCredentials,
  throwInvalidClientCredentialsWithBasicChallenge,
} from '../client-auth.js';

const DEVICE_CODE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';
const DEVICE_CODE_EXPIRES_IN = 600;
const DEVICE_CODE_INTERVAL = 5;

const DeviceAuthorizationRequestBody = z
  .object({
    client_id: f.clientId.optional(),
    client_secret: f.clientSecret.optional(),
    scope: f.scope.optional(),
  })
  .describe('OAuth2 device authorization request payload');

function createUserCode(): string {
  return toBase64Url(getRandomBytes(8)).toUpperCase();
}

export const deviceAuthorizationPost = new Hono<AppEnv>().post(
  '/device_authorization',
  describeRoute({
    tags: [TAGS.OPENID],
    summary: 'Device Authorization',
    description: 'OAuth 2.0 Device Authorization endpoint',
    responses: {
      200: { description: 'Device authorization response' },
      401: { description: 'Invalid client credentials' },
    },
  }),
  validator('form', DeviceAuthorizationRequestBody),
  async (c) => {
    const body = c.req.valid('form');
    const { config, oauthClientService, securityService, mikro } =
      c.var.services;
    const authorizationHeader = c.req.header('authorization');
    const basicCredentials = parseBasicClientCredentials(authorizationHeader);

    if (basicCredentials === null) {
      throwInvalidClientCredentialsWithBasicChallenge(c);
    }
    if (basicCredentials && body.client_secret) {
      throwInvalidClientCredentialsWithBasicChallenge(c);
    }
    if (basicCredentials && body.client_id) {
      if (basicCredentials.clientId !== body.client_id) {
        throwInvalidClientCredentialsWithBasicChallenge(c);
      }
    }

    const clientId = basicCredentials?.clientId ?? body.client_id;
    if (!clientId) {
      throwInvalidClientCredentialsWithBasicChallenge(c);
    }

    const client = await oauthClientService.findByClientId(clientId);
    oauthClientService.validateEnabled(client);
    oauthClientService.validateGrantType(client, DEVICE_CODE_GRANT_TYPE);

    const clientSecret = basicCredentials?.clientSecret ?? body.client_secret;
    try {
      await oauthClientService.validateClientSecretIfRequired(
        clientId,
        clientSecret,
      );
    } catch (err) {
      if (authorizationHeader) {
        setBasicClientAuthChallengeIfInvalidClientCredentials(c, err);
      }
      throw err;
    }

    const requestedScopes = body.scope ? body.scope.split(' ') : [];
    oauthClientService.validateScopes(client, requestedScopes);

    const deviceCode = toBase64Url(getRandomBytes(32));
    const userCode = createUserCode();
    const deviceCodeHash = await securityService.hashOpaqueToken(
      'oauth-device-code',
      deviceCode,
    );
    const userCodeHash = await securityService.hashOpaqueToken(
      'oauth-device-user-code',
      userCode,
    );

    await mikro.oauthDeviceCode.createDeviceAuthorization({
      clientId: client.id,
      deviceCodeHash,
      userCodeHash,
      scope: requestedScopes,
      expiresInSeconds: DEVICE_CODE_EXPIRES_IN,
    });

    const verificationUri = `${config.server.public_origin}/oauth/device`;
    const verificationUriComplete = new URL(verificationUri);
    verificationUriComplete.searchParams.set('user_code', userCode);

    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');
    return c.json(
      {
        device_code: deviceCode,
        user_code: userCode,
        verification_uri: verificationUri,
        verification_uri_complete: verificationUriComplete.toString(),
        expires_in: DEVICE_CODE_EXPIRES_IN,
        interval: DEVICE_CODE_INTERVAL,
      },
      200,
    );
  },
);

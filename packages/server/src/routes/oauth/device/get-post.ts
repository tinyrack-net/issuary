import { Hono } from 'hono';
import { describeRoute, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../lib/app-env.ts';
import { escapeHtml } from '../../../lib/escape-html.js';
import { TAGS } from '../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../middleware/auth.ts';
import { e } from '../../../schemas/error.ts';

const DeviceVerificationRequestBody = z.object({
  user_code: z.string().min(1).max(64),
});

export const deviceGetPost = new Hono<AppEnv>()
  .get(
    '/device',
    describeRoute({
      tags: [TAGS.OPENID],
      summary: 'Device Verification',
      description: 'User-facing OAuth device verification page',
      responses: {
        200: { description: 'Device verification form' },
      },
    }),
    verifyAuth({ optional: true }),
    async (c) => {
      const userCode = c.req.query('user_code') ?? '';
      const verifiedUser = c.var.verifiedUser;

      if (!verifiedUser) {
        const loginUrl = `/login?return_to=${encodeURIComponent(`/oauth/device?user_code=${encodeURIComponent(userCode)}`)}`;
        return c.html(
          `<!doctype html><html><body><p>Sign in to approve the device.</p><p><a href="${escapeHtml(loginUrl)}">Sign in</a></p></body></html>`,
        );
      }

      const { mikro, securityService } = c.var.services;
      let deviceDetails = '';
      if (userCode) {
        const userCodeHash = await securityService.hashOpaqueToken(
          'oauth-device-user-code',
          userCode.toUpperCase(),
        );
        const deviceCode =
          await mikro.oauthDeviceCode.findPendingByUserCodeHash(userCodeHash);
        if (deviceCode) {
          await mikro.em.populate(deviceCode, ['client']);
          const scopes = deviceCode.scope
            .map((scope) => `<li>${escapeHtml(scope)}</li>`)
            .join('');
          deviceDetails = `<section><h2>${escapeHtml(deviceCode.client.name)}</h2><p>Requested scopes:</p><ul>${scopes}</ul></section>`;
        }
      }

      return c.html(
        `<!doctype html><html><body>${deviceDetails}<form method="post"><input name="user_code" value="${escapeHtml(userCode)}"><button type="submit">Approve</button></form></body></html>`,
      );
    },
  )
  .post(
    '/device',
    describeRoute({
      tags: [TAGS.OPENID],
      summary: 'Approve Device Authorization',
      description: 'Approves a pending OAuth device authorization request',
      responses: {
        200: { description: 'Device authorization approved' },
        400: { description: 'Invalid device user code' },
      },
    }),
    validator('form', DeviceVerificationRequestBody),
    verifyAuth(),
    async (c) => {
      const { user_code: userCode } = c.req.valid('form');
      const { mikro, securityService } = c.var.services;
      const userCodeHash = await securityService.hashOpaqueToken(
        'oauth-device-user-code',
        userCode.toUpperCase(),
      );
      const user = c.var.verifiedUser.user;
      const deviceCode =
        await mikro.oauthDeviceCode.approvePendingByUserCodeHash({
          userCodeHash,
          userSub: user.sub,
          approvedAt: new Date(),
        });

      if (!deviceCode) {
        throw new e.InvalidDeviceCode.Error();
      }

      return c.json({
        status: 'approved',
        client_id: deviceCode.client.clientId,
      });
    },
  );

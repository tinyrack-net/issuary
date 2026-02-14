import { createRouter } from '@backend/lib/create-router.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { createRoute, z } from '@hono/zod-openapi';

/**
 * POST /api/v1/user/totp/verify
 *
 * Verify TOTP code during setup.
 */
const route = createRoute({
  method: 'post',
  path: '/user/totp/verify',
  tags: [TAGS.USER],
  summary: 'Verify TOTP Setup',
  description:
    'Verify the TOTP code from authenticator app. ' +
    'Must call setup endpoint first to get the QR code. ' +
    'Returns one-time recovery codes. Call confirm endpoint after ' +
    'user acknowledges saving the recovery codes to complete setup.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            code: f.totpCode,
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: r.RecoveryCodesResponse,
        },
      },
      description: 'Success',
    },
    400: {
      content: {
        'application/json': {
          schema: e.TotpNotSetup.Schema,
        },
      },
      description: 'TOTP not setup or invalid TOTP code',
    },
    401: {
      content: {
        'application/json': {
          schema: e.Unauthorized.Schema,
        },
      },
      description: 'Unauthorized',
    },
    409: {
      content: {
        'application/json': {
          schema: e.TotpAlreadyEnabled.Schema,
        },
      },
      description: 'TOTP already enabled',
    },
  },
});

export default createRouter().openapi(route, async (c) => {
  const body = c.req.valid('json');
  const session = c.get('session');
  const { totpService } = c.get('services');

  // Allow both full user session and pending 2FA setup session
  const userSession = session.get('user');
  const pending2FASetup = session.get('pending2FASetup');
  const userId = userSession?.id ?? pending2FASetup?.id;

  if (!userId) {
    throw new e.Unauthorized.Error();
  }

  const recoveryCodes = await totpService.verifySetup(userId, body.code);

  return c.json({ recovery_codes: recoveryCodes }, 200);
});

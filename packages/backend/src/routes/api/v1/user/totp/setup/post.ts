import { createRouter } from '@backend/lib/create-router.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { r } from '@backend/schemas/response.js';
import { createRoute } from '@hono/zod-openapi';

/**
 * POST /api/v1/user/totp/setup
 *
 * Start TOTP setup for the current user.
 * Generates a new secret and returns QR code for authenticator app.
 */
const route = createRoute({
  method: 'post',
  path: '/user/totp/setup',
  tags: [TAGS.USER],
  summary: 'Start TOTP Setup',
  description:
    'Generate a new TOTP secret and QR code for authenticator app setup. ' +
    'Call verify endpoint after user scans the QR code to complete setup.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: r.TotpSetupResponse,
        },
      },
      description: 'Success',
    },
    401: {
      content: {
        'application/json': {
          schema: e.Unauthorized.Schema,
        },
      },
      description: 'Unauthorized',
    },
    403: {
      content: {
        'application/json': {
          schema: e.SecondFactorNotAllowedForConfigUser.Schema,
        },
      },
      description: 'Second factor not allowed for config user',
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
  const { config, mikro, totpService } = c.get('services');
  const session = c.get('session');

  if (!config.auth.password.totp?.enabled) {
    throw new e.ValidationError.Error('TOTP is disabled');
  }

  const userSession = session.get('user');
  const pending2FASetup = session.get('pending2FASetup');
  const userId = userSession?.id ?? pending2FASetup?.id;

  if (!userId) {
    throw new e.Unauthorized.Error();
  }

  const user = await mikro.user.findOneOrFail(
    { id: userId },
    {
      failHandler: () => new e.UserNotFound.Error(),
    },
  );

  // Config users cannot setup 2FA
  if (user.managed_by === 'config') {
    throw new e.SecondFactorNotAllowedForConfigUser.Error();
  }

  const setupData = await totpService.startSetup(user);

  return c.json(
    {
      secret: setupData.secret,
      otpauth_url: setupData.otpauthUrl,
      qr_code: setupData.qrCodeDataUrl,
    },
    200,
  );
});

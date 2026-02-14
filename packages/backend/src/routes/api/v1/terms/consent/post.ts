import { createRouter } from '@backend/lib/create-router.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { termsSchema } from '@backend/schemas/terms.js';
import { createRoute } from '@hono/zod-openapi';

/**
 * POST /api/v1/terms/consent
 *
 * Record user consent for terms of service.
 */
const route = createRoute({
  method: 'post',
  path: '/terms/consent',
  tags: [TAGS.TERMS],
  summary: 'Submit terms consent',
  description:
    'Record user consent decisions for terms of service. ' +
    'Required terms must be agreed to. ' +
    'For pending OAuth registration, this also completes user registration.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: termsSchema.TermsConsentRequest,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: termsSchema.TermsConsentResponse,
        },
      },
      description: 'Success',
    },
    400: {
      content: {
        'application/json': {
          schema: e.ValidationError.Schema,
        },
      },
      description: 'Validation error or OAuth session expired',
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
          schema: e.RegistrationEmailNotAllowed.Schema,
        },
      },
      description: 'Registration email not allowed',
    },
  },
});

export default createRouter().openapi(route, async (c) => {
  const body = c.req.valid('json');
  const { consents } = body;
  const session = c.get('session');
  const auth = c.get('auth');
  const { termsService, oauthConnectService } = c.get('services');

  // Check for pending OAuth registration session
  const pendingRegistration = session.get('pendingOAuthRegistration');

  if (pendingRegistration) {
    // Check if session has expired
    if (Date.now() > pendingRegistration.expiresAt) {
      session.set('pendingOAuthRegistration', undefined);
      throw new e.OAuthSessionExpired.Error();
    }

    // Validate explicit terms consent
    const validation = await termsService.validateExplicitConsents(consents);

    if (!validation.valid) {
      throw new e.ValidationError.Error(
        `Missing required terms: ${validation.missingTerms.join(', ')}`,
      );
    }

    // Complete OAuth registration
    const result = await oauthConnectService.completeOAuthRegistration({
      providerId: pendingRegistration.providerId,
      tokens: {
        access_token: pendingRegistration.tokens.access_token,
        refresh_token: pendingRegistration.tokens.refresh_token,
        expires_in: pendingRegistration.tokens.expires_in,
        token_type: pendingRegistration.tokens.token_type,
      },
      userInfo: {
        id: pendingRegistration.userInfo.id,
        email: pendingRegistration.userInfo.email,
        email_verified: pendingRegistration.userInfo.email_verified,
        name: pendingRegistration.userInfo.name,
        picture: pendingRegistration.userInfo.picture,
      },
      consents,
    });

    // Set user session
    session.setUserSession(result.user.id);

    // Clear pending registration session
    session.set('pendingOAuthRegistration', undefined);

    return c.json(
      {
        ok: true as const,
        recorded: consents.length,
        registered: true,
      },
      200,
    );
  }

  // Standard flow: authenticated user recording consent
  const userSession = await auth.verify();

  // Validate and record consents
  const { validation, records } = await termsService.validateAndRecordConsents({
    userId: userSession.id,
    consents,
  });

  if (!validation.valid) {
    throw new e.ValidationError.Error(
      `Missing required terms: ${validation.missingTerms.join(', ')}`,
    );
  }

  return c.json(
    {
      ok: true as const,
      recorded: records.length,
    },
    200,
  );
});

import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { verifyAuth } from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { termsSchema } from '@backend/schemas/terms.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';

/**
 * POST /api/terms/consent
 *
 * Record user consent for terms of service.
 */
export const termsConsentPost = new Hono<AppEnv>().post(
  '/terms/consent',
  describeRoute({
    tags: [TAGS.TERMS],
    summary: 'Submit terms consent',
    description:
      'Record user consent decisions for terms of service. ' +
      'Required terms must be agreed to. ' +
      'For pending OAuth registration, this also completes user registration.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(termsSchema.TermsConsentResponse),
          },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.ValidationError.Schema),
          },
        },
        description: 'Validation error or OAuth session expired',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.Unauthorized.Schema),
          },
        },
        description: 'Unauthorized',
      },
      403: {
        content: {
          'application/json': {
            schema: resolver(e.RegistrationEmailNotAllowed.Schema),
          },
        },
        description: 'Registration email not allowed',
      },
    },
  }),
  validator('json', termsSchema.TermsConsentRequest),
  verifyAuth({ optional: true }),
  async (c) => {
    const body = c.req.valid('json');
    const { consents, registrationToken } = body;
    const session = c.var.session;
    const { mikro, termsService, oauthConnectService } = c.var.services;

    // Check for pending OAuth registration (stored in DB, referenced by token)
    if (registrationToken) {
      const pendingRegistration =
        await mikro.pendingOAuthRegistration.findValidByToken(
          registrationToken,
        );

      if (!pendingRegistration) {
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
          access_token: pendingRegistration.accessToken,
          refresh_token: pendingRegistration.refreshToken ?? undefined,
          expires_in: pendingRegistration.expiresIn ?? undefined,
          token_type: pendingRegistration.tokenType,
        },
        userInfo: pendingRegistration.userInfo,
        consents,
      });

      // Set user session
      session.setUserSession(result.user.id);

      // Clean up: remove DB record
      await mikro.pendingOAuthRegistration.consumeByToken(registrationToken);

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
    const userEntity = c.var.verifiedUser;
    if (!userEntity) {
      throw new e.Unauthorized.Error();
    }

    // Validate and record consents
    const { validation, records } =
      await termsService.validateAndRecordConsents({
        userId: userEntity.id,
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
  },
);

import { UniqueConstraintViolationException } from '@mikro-orm/core';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../lib/app-env.ts';
import {
  OPENAPI_SECURITY,
  securityMutationDocumentation,
} from '../../../../lib/openapi.ts';
import { TAGS } from '../../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../../middleware/auth.ts';
import { e } from '../../../../schemas/error.ts';
import { termsSchema } from '../../../../schemas/terms.ts';
import { withBrowserSecurity } from '../../../../services/browser-security.service.js';
import { lockTermsPolicy } from '../../../../services/terms-policy.service.js';

/**
 * POST /api/terms/consent
 *
 * Record user consent for terms of service.
 */
export const termsConsentPost = new Hono<AppEnv>().post(
  '/terms/consent',
  describeRoute({
    tags: [TAGS.TERMS],
    security: OPENAPI_SECURITY.optionalCookieSession,
    summary: 'Submit terms consent',
    description:
      'Record user consent decisions for terms of service. ' +
      'Required terms must be agreed to. ' +
      'Pending OAuth tokens can create a new account only; if that identity or email now exists, restart OAuth login.',
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
            schema: resolver(
              z.union([e.ValidationError.Schema, e.OAuthSessionExpired.Schema]),
            ),
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
  securityMutationDocumentation,
  async (c) => {
    const body = c.req.valid('json');
    const { consents, registrationToken } = body;
    const session = c.var.session;
    const { mikro, termsService, oauthConnectService } = c.var.services;

    // Check for pending OAuth registration (stored in DB, referenced by token)
    if (registrationToken) {
      try {
        return await session.atomic(async () => {
          await lockTermsPolicy(mikro.em, 'read');
          const pendingRegistration =
            await mikro.pendingOAuthRegistration.claim(registrationToken);

          if (!pendingRegistration) {
            throw new e.OAuthSessionExpired.Error();
          }

          // Validate explicit terms consent
          const validation =
            await termsService.validateExplicitConsents(consents);

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
          session.setUserSession(result.user.sub, result.user.token_epoch);

          // Clean up: remove DB record
          await mikro.pendingOAuthRegistration.consumeByToken(
            registrationToken,
          );

          return c.json(
            {
              ok: true as const,
              recorded: consents.length,
              registered: true,
            },
            200,
          );
        });
      } catch (error) {
        // Another new-account flow may win the unique identity/email insert.
        if (error instanceof UniqueConstraintViolationException)
          throw new e.OAuthSessionExpired.Error();
        throw error;
      }
    }

    // Standard flow: authenticated user recording consent
    const verifiedAuth = c.var.verifiedUser;
    if (!verifiedAuth) {
      throw new e.Unauthorized.Error();
    }

    return withBrowserSecurity(
      c,
      async () => {
        // Validate and record consents
        const { validation, records } =
          await termsService.validateAndRecordConsents({
            userSub: verifiedAuth.user.sub,
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
      { termsPolicy: 'read' },
    );
  },
);

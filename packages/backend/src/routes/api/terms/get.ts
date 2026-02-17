import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { f } from '@backend/schemas/field.js';
import { termsSchema } from '@backend/schemas/terms.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

/**
 * GET /api/terms
 *
 * Returns list of terms with user consent status.
 * Can be called by both authenticated and unauthenticated users.
 */
export const termsGet = new Hono<AppEnv>().get(
  '/terms',
  describeRoute({
    tags: [TAGS.TERMS],
    summary: 'Get terms of service',
    description:
      'Returns list of terms with consent mode and user consent status. ' +
      'If user is authenticated, includes their consent history.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(termsSchema.TermsResponse),
          },
        },
        description: 'Success',
      },
    },
  }),
  validator(
    'query',
    z.object({
      lang: f.languageCode,
    }),
  ),
  async (c) => {
    const query = c.req.valid('query');
    const { lang } = query;
    const session = c.var.session;
    const { termsService } = c.var.services;

    const userId = session.get('user')?.id || null;

    const terms = await termsService.getGlobalTermsWithConsent(userId, lang);

    const pendingTerms = termsService.getPendingFromLocalizedTerms(terms);

    return c.json(
      {
        terms: terms.map((t) => ({
          ...t,
          userConsent: t.userConsent
            ? {
                ...t.userConsent,
                agreedAt: t.userConsent.agreedAt?.toISOString() ?? null,
              }
            : null,
        })),
        pendingTerms,
      },
      200,
    );
  },
);

import { createRoute } from '@hono/zod-openapi';
import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { f } from '@/schemas/field.js';
import { termsSchema } from '@/schemas/terms.js';
import type { AppType } from '@/types.js';

/**
 * GET /api/v1/terms
 *
 * Returns list of terms with user consent status.
 * Can be called by both authenticated and unauthenticated users.
 */
const route = createRoute({
  method: 'get',
  path: '/terms',
  tags: [TAGS.TERMS],
  summary: 'Get terms of service',
  description:
    'Returns list of terms with consent mode and user consent status. ' +
    'If user is authenticated, includes their consent history.',
  request: {
    query: z.object({
      lang: f.languageCode,
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: termsSchema.TermsResponse,
        },
      },
      description: 'Success',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    const query = c.req.valid('query');
    const { lang } = query;
    const session = c.get('session');
    const { termsService } = c.get('services');

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
  });
};

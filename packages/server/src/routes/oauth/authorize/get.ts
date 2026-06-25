import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../lib/app-env.ts';
import { escapeHtml } from '../../../lib/escape-html.js';
import { OPENAPI_SECURITY } from '../../../lib/openapi.ts';
import { TAGS } from '../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../middleware/auth.ts';
import { e } from '../../../schemas/error.ts';
import { f } from '../../../schemas/field.ts';
import { r } from '../../../schemas/response.ts';
import type { AuthorizeParams } from '../../../services/oauth-authorize.service.ts';

export const authorizeGet = new Hono<AppEnv>().get(
  '/authorize',
  describeRoute({
    tags: [TAGS.OPENID],
    security: OPENAPI_SECURITY.optionalCookieSession,
    summary: 'Authorize',
    description: 'OAuth2 Authorization Endpoint',
    responses: {
      302: {
        description: 'Redirect',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(r.OAuthError),
          },
        },
        description: 'OAuth error',
      },
    },
  }),
  validator(
    'query',
    z.object({
      response_type: f.responseType,
      redirect_uri: f.redirectUri,
      state: f.state.optional(),
      client_id: f.clientId,
      code_challenge: f.codeChallenge.optional(),
      code_challenge_method: f.codeChallengeMethod.optional(),
      scope: f.scope.optional(),
      nonce: f.nonce.optional(),
      prompt: f.prompt.optional(),
      max_age: f.maxAge.optional(),
      reauthenticated: z.literal('1').optional(),
      account_selected: z
        .preprocess((value) => {
          if (value === 1) return '1';
          if (typeof value !== 'string') return value;
          return decodeURIComponent(value).replaceAll('"', '');
        }, z.literal('1'))
        .optional(),
      account_selection_state: z.string().min(1).max(200).optional(),
      display: f.display.optional(),
      response_mode: z.string().min(1).max(100).optional(),
      login_hint: z.string().min(1).max(1000).optional(),
      ui_locales: z.string().min(1).max(1000).optional(),
      id_token_hint: z.string().min(1).max(4000).optional(),
      acr_values: z.string().min(1).max(1000).optional(),
    }),
  ),
  verifyAuth({ optional: true }),
  async (c) => {
    const query = c.req.valid('query');
    const { oauthAuthorizeService } = c.var.services;

    // Helper function to redirect with error
    const redirectWithError = (
      error: string,
      errorDescription: string,
      redirectUri?: string,
    ) => {
      if (!redirectUri) {
        return c.json(
          {
            error,
            error_description: errorDescription,
          },
          400,
        );
      }

      if (query.response_mode === 'form_post') {
        const params: Record<string, string> = {
          error,
          error_description: errorDescription,
        };
        if (query.state) {
          params['state'] = query.state;
        }
        return c.html(buildFormPostResponse(redirectUri, params));
      }

      const url = new URL(redirectUri);
      const useFragment =
        query.response_mode === 'fragment' ||
        (query.response_type === 'id_token' && query.response_mode !== 'query');
      const params = useFragment ? new URLSearchParams() : url.searchParams;
      params.set('error', error);
      params.set('error_description', errorDescription);
      if (query.state) {
        params.set('state', query.state);
      }

      if (useFragment) {
        url.hash = params.toString();
      }

      return c.redirect(url.toString());
    };

    try {
      const verifiedUser = c.var.verifiedUser;

      // Call authorize service
      const authorizeParams: {
        query: AuthorizeParams;
        userSession?: {
          sub: string;
          authenticated_at: number;
        };
        rememberedAccounts?: Array<{
          sub: string;
          authenticated_at: number;
          last_used_at: number;
        }>;
        selectUserSession?: (userSub: string) => boolean;
        accountSelectionSession?:
          | NonNullable<
              ReturnType<typeof c.var.session.get<'accountSelection'>>
            >
          | undefined;
        setAccountSelectionSession?: (
          state: NonNullable<
            ReturnType<typeof c.var.session.get<'accountSelection'>>
          >,
        ) => void;
        clearAccountSelectionSession?: () => void;
      } = {
        query: query,
      };

      if (verifiedUser) {
        authorizeParams.userSession = {
          sub: verifiedUser.user.sub,
          authenticated_at: verifiedUser.authenticatedAt,
        };
      }
      const rememberedAccounts = c.var.session.get('accounts');
      if (rememberedAccounts) {
        authorizeParams.rememberedAccounts = rememberedAccounts;
        authorizeParams.selectUserSession = (userSub) =>
          c.var.session.selectUserSession(userSub);
      }
      authorizeParams.accountSelectionSession =
        c.var.session.get('accountSelection');
      authorizeParams.setAccountSelectionSession = (state) =>
        c.var.session.set('accountSelection', state);
      authorizeParams.clearAccountSelectionSession = () =>
        c.var.session.set('accountSelection', undefined);

      const result = await oauthAuthorizeService.authorize(authorizeParams);

      if (result.type === 'form_post') {
        return c.html(buildFormPostResponse(result.url, result.params ?? {}));
      }

      // Redirect based on result
      return c.redirect(result.url);
    } catch (error) {
      // RFC 6749 §4.1.2.1: If client_id is invalid or redirect_uri validation fails,
      // do NOT redirect to the provided redirect_uri
      if (error instanceof e.OAuthClientNotFound.Error) {
        return redirectWithError(
          'unauthorized_client',
          error.message,
          undefined,
        );
      }

      if (error instanceof e.OAuthClientDisabled.Error) {
        return redirectWithError(
          'unauthorized_client',
          error.message,
          undefined,
        );
      }

      if (error instanceof e.InvalidRedirectUri.Error) {
        return redirectWithError('invalid_request', error.message, undefined);
      }

      // Only redirect errors that occur AFTER successful client + redirect_uri validation
      if (error instanceof e.UnsupportedResponseType.Error) {
        return redirectWithError(
          'unsupported_response_type',
          error.message,
          query.redirect_uri,
        );
      }

      if (error instanceof e.InvalidScope.Error) {
        return redirectWithError(
          'invalid_scope',
          error.message,
          query.redirect_uri,
        );
      }

      if (error instanceof e.InvalidCodeChallengeMethod.Error) {
        return redirectWithError(
          'invalid_request',
          error.message,
          query.redirect_uri,
        );
      }

      if (error instanceof e.InvalidAuthorizationRequest.Error) {
        return redirectWithError(
          'invalid_request',
          error.message,
          query.redirect_uri,
        );
      }

      if (error instanceof e.InvalidPrompt.Error) {
        return redirectWithError(
          'invalid_request',
          error.message,
          query.redirect_uri,
        );
      }

      // Log unexpected errors. Do not redirect unexpected failures to the
      // client-supplied redirect_uri because this handler cannot prove that
      // redirect_uri validation completed successfully.
      c.var.logger.error({ err: error }, 'Unexpected authorize error');
      return c.json(
        {
          error: 'server_error',
          error_description: 'An unexpected error occurred',
        },
        500,
      );
    }
  },
);

function buildFormPostResponse(action: string, params: Record<string, string>) {
  const inputs = Object.entries(params)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
    )
    .join('');

  return `<!doctype html><html><head><title>Submit Authorization Response</title></head><body><form method="post" action="${escapeHtml(action)}">${inputs}<noscript><button type="submit">Continue</button></noscript></form><script>document.forms[0].submit();</script></body></html>`;
}

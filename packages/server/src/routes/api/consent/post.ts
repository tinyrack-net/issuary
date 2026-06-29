import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../lib/openapi.ts';
import { TAGS } from '../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../middleware/auth.ts';
import { e } from '../../../schemas/error.ts';
import { f } from '../../../schemas/field.ts';
import { r } from '../../../schemas/response.ts';

function consumeConsentPrompt(
  prompt: string | undefined,
  hasTrustedReauthentication: boolean,
): string | undefined {
  if (!prompt) {
    return undefined;
  }
  const remaining = prompt
    .split(' ')
    .filter(
      (value) =>
        value !== 'consent' &&
        !(hasTrustedReauthentication && value === 'login'),
    )
    .join(' ');
  return remaining.length > 0 ? remaining : undefined;
}

function buildReauthenticationRequestFingerprint(params: {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope?: string | undefined;
  state?: string | undefined;
  nonce?: string | undefined;
  code_challenge?: string | undefined;
  code_challenge_method?: 'S256' | 'plain' | undefined;
  prompt?: string | undefined;
  max_age?: number | undefined;
  display?: 'page' | 'popup' | 'touch' | 'wap' | undefined;
  response_mode?: 'query' | 'fragment' | 'form_post' | undefined;
  login_hint?: string | undefined;
  ui_locales?: string | undefined;
  id_token_hint?: string | undefined;
  acr_values?: string | undefined;
  account_selected?: '1' | undefined;
}): string {
  return JSON.stringify(
    [
      ['client_id', params.client_id],
      ['redirect_uri', params.redirect_uri],
      ['response_type', params.response_type],
      ['scope', params.scope],
      ['state', params.state],
      ['nonce', params.nonce],
      ['code_challenge', params.code_challenge],
      ['code_challenge_method', params.code_challenge_method],
      ['prompt', params.prompt],
      ['max_age', params.max_age],
      ['display', params.display],
      ['response_mode', params.response_mode],
      ['login_hint', params.login_hint],
      ['ui_locales', params.ui_locales],
      ['id_token_hint', params.id_token_hint],
      ['acr_values', params.acr_values],
      ['account_selected', params.account_selected],
    ].filter(([, value]) => value !== undefined),
  );
}

// Consent continuations may receive a request after authorize has already
// consumed `prompt=login` and left only `prompt=consent`. Accept the current
// consent fingerprint and that exact login-stripped transition only; trust is
// still bound below to the encrypted-session `sub` and `authenticated_at`.
function buildReauthenticationRequestFingerprints(params: {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope?: string | undefined;
  state?: string | undefined;
  nonce?: string | undefined;
  code_challenge?: string | undefined;
  code_challenge_method?: 'S256' | 'plain' | undefined;
  prompt?: string | undefined;
  max_age?: number | undefined;
  display?: 'page' | 'popup' | 'touch' | 'wap' | undefined;
  response_mode?: 'query' | 'fragment' | 'form_post' | undefined;
  login_hint?: string | undefined;
  ui_locales?: string | undefined;
  id_token_hint?: string | undefined;
  acr_values?: string | undefined;
  account_selected?: '1' | undefined;
}): string[] {
  const fingerprints = [buildReauthenticationRequestFingerprint(params)];
  const promptValues = params.prompt?.split(' ').filter(Boolean) ?? [];
  if (promptValues.length > 0 && !promptValues.includes('login')) {
    fingerprints.push(
      buildReauthenticationRequestFingerprint({
        ...params,
        prompt: ['login', ...promptValues].join(' '),
      }),
    );
  }
  return fingerprints;
}

function buildConsentDenyRedirectUrl(params: {
  redirectUri: string;
  state?: string | undefined;
  responseType: string;
  responseMode?: 'query' | 'fragment' | 'form_post' | undefined;
}): string {
  const errorUrl = new URL(params.redirectUri);
  const useFragment =
    params.responseMode === 'fragment' ||
    (params.responseType === 'id_token' && params.responseMode !== 'query');
  const errorParams = useFragment
    ? new URLSearchParams()
    : errorUrl.searchParams;
  errorParams.set('error', 'access_denied');
  errorParams.set(
    'error_description',
    'The resource owner or authorization server denied the request.',
  );
  if (params.state) {
    errorParams.set('state', params.state);
  }
  if (useFragment) {
    errorUrl.hash = errorParams.toString();
  }
  return errorUrl.toString();
}

/**
 * POST /api/oauth/consent
 *
 * Handles user consent decision (allow/deny).
 * If allowed, stores consent and returns the authorize URL.
 * If denied, returns the error redirect URL.
 */
export const consentPost = new Hono<AppEnv>().post(
  '/consent',
  describeRoute({
    tags: [TAGS.CONSENT],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Submit consent decision',
    description: 'Handles the user consent decision for OAuth authorization.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.RedirectUrlResponse),
          },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.OAuthClientNotFound.Schema),
          },
        },
        description: 'OAuth client not found',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.Unauthorized.Schema),
          },
        },
        description: 'Unauthorized',
      },
    },
  }),
  validator(
    'json',
    z.object({
      client_id: f.clientId,
      redirect_uri: f.redirectUri,
      response_type: f.responseType,
      scope: f.scope.optional(),
      state: f.state.optional(),
      nonce: f.nonce.optional(),
      code_challenge: f.codeChallenge.optional(),
      code_challenge_method: f.codeChallengeMethod.optional(),
      prompt: f.prompt.optional(),
      max_age: f.maxAge.optional(),
      reauthenticated: z.literal('1').optional(),
      display: f.display.optional(),
      response_mode: z.enum(['query', 'fragment', 'form_post']).optional(),
      login_hint: z.string().min(1).max(1000).optional(),
      ui_locales: z.string().min(1).max(1000).optional(),
      id_token_hint: z.string().min(1).max(4000).optional(),
      acr_values: z.string().min(1).max(1000).optional(),
      account_selected: z
        .preprocess((value) => {
          if (value === 1) return '1';
          if (typeof value !== 'string') return value;
          return decodeURIComponent(value).replaceAll('"', '');
        }, z.literal('1'))
        .optional(),
      account_selection_state: z.string().min(1).max(200).optional(),
      decision: f.consentDecision,
    }),
  ),
  verifyAuth(),
  async (c) => {
    const body = c.req.valid('json');
    const {
      client_id,
      redirect_uri,
      response_type,
      scope,
      state,
      nonce,
      code_challenge,
      code_challenge_method,
      prompt,
      max_age,
      reauthenticated,
      display,
      response_mode,
      login_hint,
      ui_locales,
      id_token_hint,
      acr_values,
      account_selected,
      account_selection_state,
      decision,
    } = body;

    const { user: userEntity } = c.var.verifiedUser;
    const { oauthClientService, userConsentService } = c.var.services;
    const requestedScopes = scope ? scope.split(' ') : [];

    const client = await oauthClientService.findByClientId(client_id);
    oauthClientService.validateEnabled(client);
    oauthClientService.validateRedirectUri(client, redirect_uri);
    oauthClientService.validateResponseType(client, response_type);
    oauthClientService.validateScopes(client, requestedScopes);

    if (response_type === 'id_token') {
      if (!requestedScopes.includes('openid') || !nonce) {
        throw new e.InvalidAuthorizationRequest.Error();
      }
    } else if (await oauthClientService.isPublicClient(client_id)) {
      if (!code_challenge || code_challenge_method !== 'S256') {
        throw new e.InvalidCodeChallengeMethod.Error();
      }
    }

    // If user denied consent, redirect back with error
    if (decision === 'deny') {
      const redirectUrl = buildConsentDenyRedirectUrl({
        redirectUri: redirect_uri,
        state,
        responseType: response_type,
        responseMode: response_mode,
      });

      return c.json({ redirect_url: redirectUrl }, 200);
    }

    // User allowed consent - store it

    await userConsentService.grantConsent({
      userSub: userEntity.sub,
      clientId: client.id,
      scopes: requestedScopes,
    });

    const reauthenticationSession = c.var.session.get('reauthentication');
    const trustedReauthenticationFingerprints =
      buildReauthenticationRequestFingerprints({
        client_id,
        redirect_uri,
        response_type,
        scope,
        state,
        nonce,
        code_challenge,
        code_challenge_method,
        prompt,
        max_age,
        display,
        response_mode,
        login_hint,
        ui_locales,
        id_token_hint,
        acr_values,
        account_selected,
      });
    const hasTrustedReauthentication =
      reauthenticated === '1' &&
      reauthenticationSession?.sub === userEntity.sub &&
      reauthenticationSession.authenticated_at ===
        c.var.verifiedUser.authenticatedAt &&
      typeof reauthenticationSession.request_fingerprint === 'string' &&
      trustedReauthenticationFingerprints.includes(
        reauthenticationSession.request_fingerprint,
      );

    // Build authorize URL to continue the flow
    const url = new URL(c.req.url);
    const authorizeUrl = new URL(
      '/oauth/authorize',
      `${url.protocol}//${url.host}`,
    );
    authorizeUrl.searchParams.set('client_id', client_id);
    authorizeUrl.searchParams.set('redirect_uri', redirect_uri);
    authorizeUrl.searchParams.set('response_type', response_type);

    if (scope) {
      authorizeUrl.searchParams.set('scope', scope);
    }
    if (state) {
      authorizeUrl.searchParams.set('state', state);
    }
    if (nonce) {
      authorizeUrl.searchParams.set('nonce', nonce);
    }
    if (code_challenge) {
      authorizeUrl.searchParams.set('code_challenge', code_challenge);
    }
    if (code_challenge_method) {
      authorizeUrl.searchParams.set(
        'code_challenge_method',
        code_challenge_method,
      );
    }
    const continuationPrompt = consumeConsentPrompt(
      prompt,
      hasTrustedReauthentication,
    );
    if (hasTrustedReauthentication) {
      c.var.session.set('reauthentication', {
        sub: userEntity.sub,
        authenticated_at: c.var.verifiedUser.authenticatedAt,
        request_fingerprint: buildReauthenticationRequestFingerprint({
          client_id,
          redirect_uri,
          response_type,
          scope,
          state,
          nonce,
          code_challenge,
          code_challenge_method,
          prompt: continuationPrompt,
          max_age,
          display,
          response_mode,
          login_hint,
          ui_locales,
          id_token_hint,
          acr_values,
          account_selected,
        }),
      });
    }
    if (continuationPrompt) {
      authorizeUrl.searchParams.set('prompt', continuationPrompt);
    }
    if (max_age !== undefined) {
      authorizeUrl.searchParams.set('max_age', max_age.toString());
    }
    if (hasTrustedReauthentication) {
      authorizeUrl.searchParams.set('reauthenticated', reauthenticated);
    }
    if (display) {
      authorizeUrl.searchParams.set('display', display);
    }
    if (response_mode) {
      authorizeUrl.searchParams.set('response_mode', response_mode);
    }
    if (login_hint) {
      authorizeUrl.searchParams.set('login_hint', login_hint);
    }
    if (ui_locales) {
      authorizeUrl.searchParams.set('ui_locales', ui_locales);
    }
    if (id_token_hint) {
      authorizeUrl.searchParams.set('id_token_hint', id_token_hint);
    }
    if (acr_values) {
      authorizeUrl.searchParams.set('acr_values', acr_values);
    }
    if (account_selected) {
      authorizeUrl.searchParams.set('account_selected', account_selected);
    }
    if (account_selection_state) {
      authorizeUrl.searchParams.set(
        'account_selection_state',
        account_selection_state,
      );
    }

    return c.json({ redirect_url: authorizeUrl.toString() }, 200);
  },
);

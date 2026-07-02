import { z } from 'zod';

const PROMPT_VALUES = new Set(['none', 'login', 'consent', 'select_account']);

function isValidPrompt(prompt: string): boolean {
  const values = prompt.split(' ');
  const seen = new Set<string>();

  for (const value of values) {
    if (!PROMPT_VALUES.has(value) || seen.has(value)) {
      return false;
    }
    seen.add(value);
  }

  if (!seen.has('none') || seen.size === 1) {
    return true;
  }
  return seen.size === 2 && seen.has('select_account');
}

/**
 * OIDC/OAuth 플로우에서 사용되는 쿼리 파라미터 스키마
 * 로그인, 회원가입, 이메일 인증 페이지에서 공통으로 사용
 */
export const OAuthSearchSchema = z.object({
  client_id: z.string().optional(),
  redirect_uri: z.string().optional(),
  response_type: z.string().optional(),
  scope: z.string().optional(),
  state: z.string().optional(),
  nonce: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(['S256', 'plain']).optional(),
  prompt: z.string().min(1).max(100).refine(isValidPrompt).optional(),
  max_age: z
    .preprocess(
      (value) => (typeof value === 'number' ? String(value) : value),
      z.string(),
    )
    .optional(),
  reauthenticated: z
    .preprocess((value) => {
      if (value === 1) return '1';
      if (typeof value !== 'string') return value;
      return decodeURIComponent(value).replaceAll('"', '').replaceAll('\\', '');
    }, z.literal('1'))
    .optional(),
  account_selected: z
    .preprocess((value) => {
      if (value === 1) return '1';
      if (typeof value !== 'string') return value;
      return decodeURIComponent(value).replaceAll('"', '').replaceAll('\\', '');
    }, z.literal('1'))
    .optional(),
  account_selection_state: z.string().min(1).max(200).optional(),
  display: z.enum(['page', 'popup', 'touch', 'wap']).optional(),
  response_mode: z.enum(['query', 'fragment', 'form_post']).optional(),
  login_hint: z.string().min(1).max(1000).optional(),
  ui_locales: z.string().min(1).max(1000).optional(),
  id_token_hint: z.string().min(1).max(4000).optional(),
  acr_values: z.string().min(1).max(1000).optional(),
  lang: z.string().optional(),
});

export type OAuthSearch = z.infer<typeof OAuthSearchSchema>;

export type AuthorizationContextSearch = OAuthSearch & {
  client_id: string;
  redirect_uri: string;
  response_type: string;
};

/** Second factor method type */
export type SecondFactorMethod = 'totp' | 'passkey';

/**
 * OAuth 플로우인지 확인하는 헬퍼 함수
 * client_id와 redirect_uri가 모두 존재해야 OAuth 플로우로 판단
 */
export function isOAuthFlow(search: OAuthSearch): boolean {
  return !!(search.client_id && search.redirect_uri);
}

export function hasAuthorizationContext(
  search: OAuthSearch,
): search is AuthorizationContextSearch {
  return !!(search.client_id && search.redirect_uri && search.response_type);
}

/**
 * OAuth authorize URL을 빌드하는 헬퍼 함수
 * 로그인/회원가입 성공 후 OAuth 플로우를 재개할 때 사용
 */
export function buildAuthorizeUrl(search: OAuthSearch): string {
  const authUrl = new URL('/oauth/authorize', window.location.origin);

  if (search.client_id) authUrl.searchParams.set('client_id', search.client_id);
  if (search.redirect_uri)
    authUrl.searchParams.set('redirect_uri', search.redirect_uri);
  if (search.response_type)
    authUrl.searchParams.set('response_type', search.response_type);
  if (search.scope) authUrl.searchParams.set('scope', search.scope);
  if (search.state) authUrl.searchParams.set('state', search.state);
  if (search.nonce) authUrl.searchParams.set('nonce', search.nonce);
  if (search.code_challenge)
    authUrl.searchParams.set('code_challenge', search.code_challenge);
  if (search.code_challenge_method)
    authUrl.searchParams.set(
      'code_challenge_method',
      search.code_challenge_method,
    );
  if (search.prompt) authUrl.searchParams.set('prompt', search.prompt);
  if (search.max_age) authUrl.searchParams.set('max_age', search.max_age);
  if (
    search.reauthenticated ||
    search.prompt?.split(' ').includes('login') ||
    search.max_age === '0'
  ) {
    authUrl.searchParams.set('reauthenticated', '1');
  }
  if (search.account_selected) {
    authUrl.searchParams.set(
      'account_selected',
      decodeURIComponent(String(search.account_selected))
        .replaceAll('"', '')
        .replaceAll('\\', ''),
    );
  }
  if (search.account_selection_state)
    authUrl.searchParams.set(
      'account_selection_state',
      search.account_selection_state,
    );
  if (search.display) authUrl.searchParams.set('display', search.display);
  if (search.response_mode)
    authUrl.searchParams.set('response_mode', search.response_mode);
  if (search.login_hint)
    authUrl.searchParams.set('login_hint', search.login_hint);
  if (search.ui_locales)
    authUrl.searchParams.set('ui_locales', search.ui_locales);
  if (search.id_token_hint)
    authUrl.searchParams.set('id_token_hint', search.id_token_hint);
  if (search.acr_values)
    authUrl.searchParams.set('acr_values', search.acr_values);

  return authUrl.toString();
}

/**
 * Build an authorize URL after an interactive authentication step completed.
 * This marks the active account as freshly selected unless the RP explicitly
 * requested account selection.
 */
export function buildAuthenticatedAuthorizeUrl(search: OAuthSearch): string {
  const authenticatedSearch: OAuthSearch = {
    ...search,
    reauthenticated: '1',
  };

  if (!search.prompt?.split(' ').includes('select_account')) {
    authenticatedSearch.account_selected = '1';
  }

  return buildAuthorizeUrl(authenticatedSearch);
}

/**
 * OAuth 파라미터만 추출하는 헬퍼 (undefined 값 제거)
 * Link 컴포넌트의 search prop에 전달할 때 사용
 */
export function extractOAuthParams(
  search: OAuthSearch,
): Partial<OAuthSearch> & Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(search).filter(([_, v]) => v !== undefined),
  );
}

import { z } from 'zod/v4';

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
  prompt: z.enum(['none', 'login', 'consent', 'select_account']).optional(),
  max_age: z.string().optional(),
  display: z.enum(['page', 'popup', 'touch', 'wap']).optional(),
});

export type OAuthSearch = z.infer<typeof OAuthSearchSchema>;

/**
 * OAuth 플로우인지 확인하는 헬퍼 함수
 * client_id와 redirect_uri가 모두 존재해야 OAuth 플로우로 판단
 */
export function isOAuthFlow(search: OAuthSearch): boolean {
  return !!(search.client_id && search.redirect_uri);
}

/**
 * OAuth authorize URL을 빌드하는 헬퍼 함수
 * 로그인/회원가입 성공 후 OAuth 플로우를 재개할 때 사용
 */
export function buildAuthorizeUrl(search: OAuthSearch): string {
  const authUrl = new URL(
    '/application/oauth/authorize',
    window.location.origin,
  );

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
  if (search.display) authUrl.searchParams.set('display', search.display);

  return authUrl.toString();
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

/**
 * TOTP 설정 페이지 URL을 빌드하는 헬퍼 함수
 * TOTP 설정이 필요한 경우 OAuth 파라미터를 유지하며 리다이렉트
 */
export function buildSetupTotpUrl(search: OAuthSearch): string {
  const setupUrl = new URL('/setup-totp', window.location.origin);

  if (search.client_id)
    setupUrl.searchParams.set('client_id', search.client_id);
  if (search.redirect_uri)
    setupUrl.searchParams.set('redirect_uri', search.redirect_uri);
  if (search.response_type)
    setupUrl.searchParams.set('response_type', search.response_type);
  if (search.scope) setupUrl.searchParams.set('scope', search.scope);
  if (search.state) setupUrl.searchParams.set('state', search.state);
  if (search.nonce) setupUrl.searchParams.set('nonce', search.nonce);
  if (search.code_challenge)
    setupUrl.searchParams.set('code_challenge', search.code_challenge);
  if (search.code_challenge_method)
    setupUrl.searchParams.set(
      'code_challenge_method',
      search.code_challenge_method,
    );
  if (search.prompt) setupUrl.searchParams.set('prompt', search.prompt);
  if (search.max_age) setupUrl.searchParams.set('max_age', search.max_age);
  if (search.display) setupUrl.searchParams.set('display', search.display);

  return setupUrl.toString();
}

/**
 * 이메일 인증 페이지 URL을 빌드하는 헬퍼 함수
 * 이메일 인증이 필요한 경우 OAuth 파라미터를 유지하며 리다이렉트
 */
export function buildVerifyEmailUrl(
  search: OAuthSearch,
  email: string,
): string {
  const verifyUrl = new URL('/verify-email', window.location.origin);

  verifyUrl.searchParams.set('email', email);

  if (search.client_id)
    verifyUrl.searchParams.set('client_id', search.client_id);
  if (search.redirect_uri)
    verifyUrl.searchParams.set('redirect_uri', search.redirect_uri);
  if (search.response_type)
    verifyUrl.searchParams.set('response_type', search.response_type);
  if (search.scope) verifyUrl.searchParams.set('scope', search.scope);
  if (search.state) verifyUrl.searchParams.set('state', search.state);
  if (search.nonce) verifyUrl.searchParams.set('nonce', search.nonce);
  if (search.code_challenge)
    verifyUrl.searchParams.set('code_challenge', search.code_challenge);
  if (search.code_challenge_method)
    verifyUrl.searchParams.set(
      'code_challenge_method',
      search.code_challenge_method,
    );
  if (search.prompt) verifyUrl.searchParams.set('prompt', search.prompt);
  if (search.max_age) verifyUrl.searchParams.set('max_age', search.max_age);
  if (search.display) verifyUrl.searchParams.set('display', search.display);

  return verifyUrl.toString();
}

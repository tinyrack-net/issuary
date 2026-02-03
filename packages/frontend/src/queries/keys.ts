/**
 * Query Key 팩토리
 *
 * 모든 Query Key를 중앙에서 관리하여 일관성과 타입 안전성을 보장합니다.
 * 각 키는 API 경로를 기반으로 정의됩니다.
 */
export const queryKeys = {
  // 세션
  session: () => ['/api/v1/user/session'] as const,

  // 앱 설정
  config: () => ['/api/v1/config'] as const,

  // OAuth
  oauth: {
    accounts: () => ['/api/v1/user/oauth-accounts'] as const,
  },

  // 동의 (Consent)
  consent: (clientId: string, scope?: string) =>
    ['/api/v1/consent', clientId, scope] as const,

  // Passkeys
  passkeys: () => ['/api/v1/user/passkeys'] as const,

  // Terms
  terms: (lang?: string) => ['/api/v1/terms', lang] as const,
} as const;

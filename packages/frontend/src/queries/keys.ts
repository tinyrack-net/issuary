/**
 * Query Key 팩토리
 *
 * 모든 Query Key를 중앙에서 관리하여 일관성과 타입 안전성을 보장합니다.
 * 각 키는 API 경로를 기반으로 정의됩니다.
 */
export const queryKeys = {
  // 세션
  session: () => ['/api/user/session'] as const,

  // Account selection
  accounts: (clientId?: string) => ['/api/auth/accounts', clientId] as const,

  // 앱 설정
  config: () => ['/api/config'] as const,

  // OAuth
  oauth: {
    accounts: () => ['/api/user/oauth-accounts'] as const,
  },

  // 동의 (Consent)
  consent: (clientId: string, scope?: string) =>
    ['/api/consent', clientId, scope] as const,

  // Passkeys
  passkeys: () => ['/api/user/passkeys'] as const,

  // Terms
  terms: (lang?: string) => ['/api/terms', lang] as const,
} as const;

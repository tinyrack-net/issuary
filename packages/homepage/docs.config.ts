import { defineDocsConfig } from '@tinyrack/docs/config';

const labels = (en: string, ko: string, ja: string) => ({ en, ja, ko });
const page = (contentKey: string) => ({ type: 'page' as const, contentKey });

export default defineDocsConfig({
  contentDir: 'app/content',
  header: {
    links: [
      {
        label: 'GitHub',
        path: 'https://github.com/tinyrack-net/tinyauth',
      },
    ],
  },
  i18n: {
    defaultLocale: 'en',
    locales: {
      en: { label: 'English', language: 'en', openGraph: 'en_US' },
      ko: {
        label: '한국어',
        language: 'ko',
        openGraph: 'ko_KR',
        messages: {
          closeNavigation: '탐색 닫기',
          closeSearch: '검색 닫기',
          emptySearch: '문서를 찾지 못했어요.',
          language: '언어',
          loading: '페이지 불러오는 중',
          navigation: '문서',
          navigationSidebar: '문서 사이드바',
          next: '다음',
          nextDocument: '다음 문서',
          onThisPage: '이 페이지에서',
          openNavigation: '탐색 열기',
          previous: '이전',
          previousDocument: '이전 문서',
          search: '문서 검색',
          searchFallback: '번들된 대체 검색 인덱스를 사용 중입니다.',
          searchIdle: '검색어를 입력하세요.',
          searchLoading: '문서 검색 중',
          searchResults: '검색 결과',
        },
      },
      ja: {
        label: '日本語',
        language: 'ja',
        openGraph: 'ja_JP',
        messages: {
          closeNavigation: 'ナビゲーションを閉じる',
          closeSearch: '検索を閉じる',
          emptySearch: 'ドキュメントが見つかりません。',
          language: '言語',
          loading: 'ページを読み込み中',
          navigation: 'ドキュメント',
          navigationSidebar: 'ドキュメントサイドバー',
          next: '次へ',
          nextDocument: '次のドキュメント',
          onThisPage: 'このページ',
          openNavigation: 'ナビゲーションを開く',
          previous: '前へ',
          previousDocument: '前のドキュメント',
          search: 'ドキュメントを検索',
          searchFallback: '組み込みの代替検索インデックスを使用しています。',
          searchIdle: '検索語を入力してください。',
          searchLoading: 'ドキュメントを検索中',
          searchResults: '検索結果',
        },
      },
    },
  },
  navigation: [
    {
      type: 'group',
      label: labels('Getting Started', '시작하기', 'はじめに'),
      children: [
        page('/getting-started/introduction'),
        page('/getting-started/one-minute-start'),
        page('/getting-started/comparison'),
      ],
    },
    {
      type: 'group',
      label: labels('Deployment', '배포', 'デプロイ'),
      children: [page('/deployment/docker'), page('/deployment/kubernetes')],
    },
    {
      type: 'group',
      label: labels('Configuration', '설정', '設定'),
      children: [
        page('/configuration/overview'),
        page('/configuration/environment-variables'),
        {
          type: 'group',
          label: labels('Basic Configuration', '애플리케이션', '基本設定'),
          children: [
            'general',
            'register',
            'reverse-proxy',
            'client-security',
            'theme',
            'language',
            'branding',
          ].map((slug) => page(`/configuration/general/${slug}`)),
        },
        {
          type: 'group',
          label: labels('Database', '데이터베이스', 'データベース'),
          children: ['sqlite', 'postgresql'].map((slug) =>
            page(`/configuration/database/${slug}`),
          ),
        },
        {
          type: 'group',
          label: labels('Authentication', '기본 인증', '認証'),
          children: ['password', 'email-verification', 'totp', 'passkey'].map(
            (slug) => page(`/configuration/authentication/${slug}`),
          ),
        },
        {
          type: 'group',
          label: labels(
            'Identity Provider',
            '타사 로그인',
            'アイデンティティプロバイダー',
          ),
          children: ['overview', 'google', 'apple', 'github', 'others'].map(
            (slug) => page(`/configuration/oauth/${slug}`),
          ),
        },
        {
          type: 'group',
          label: labels('Terms of Service', '약관', '利用規約'),
          children: ['choose-flow', 'implicit-flow', 'explicit-flow'].map(
            (slug) => page(`/configuration/terms/${slug}`),
          ),
        },
        {
          type: 'group',
          label: labels('Client Integration', '클라이언트 연동', '連携'),
          children: ['overview', 'nextjs', 'react-spa'].map((slug) =>
            page(`/configuration/client-integration/${slug}`),
          ),
        },
        {
          type: 'group',
          label: labels('Management', '관리', '管理'),
          children: [page('/configuration/scheduler')],
        },
      ],
    },
    {
      type: 'group',
      label: labels('Reference', '레퍼런스', 'リファレンス'),
      children: [
        page('/reference/configuration-schema'),
        page('/reference/api'),
        page('/api-reference'),
      ],
    },
  ],
  redirects: { '/': '/en/' },
  sections: [
    { id: 'getting-started', label: 'Getting Started', order: 0 },
    { id: 'deployment', label: 'Deployment', order: 1 },
    { id: 'configuration', label: 'Configuration', order: 2 },
    { id: 'reference', label: 'Reference', order: 3 },
  ],
  site: {
    basePath: '/',
    description:
      'A lightweight OpenID Connect (OIDC) Provider for modern applications.',
    favicon: '/favicon.svg',
    locale: { language: 'en', openGraph: 'en_US' },
    logo: { alt: 'Tinyauth', dark: '/favicon.svg', light: '/favicon.svg' },
    title: 'Tinyauth',
    url: 'https://tinyauth.tinyrack.net',
  },
  theme: { default: 'dark' },
});

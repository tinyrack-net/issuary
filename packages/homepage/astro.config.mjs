import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 8082,
    allowedHosts: ['desktop.server.lan'],
  },
  integrations: [
    starlight({
      title: 'Tinyauth',
      description: 'OpenID Connect (OIDC) Provider Documentation',
      customCss: ['./src/styles/custom.css'],
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'English',
          lang: 'en',
        },
        ko: {
          label: '한국어',
          lang: 'ko',
        },
        // ja: {
        //   label: '日本語',
        //   lang: 'ja',
        // },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/tinyrack/auth',
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          translations: {
            ko: '시작하기',
            ja: 'はじめに',
          },
          items: [
            { slug: 'getting-started/introduction' },
            { slug: 'getting-started/one-minute-start' },
            { slug: 'getting-started/comparison' },
          ],
        },
        {
          label: 'Deployment',
          translations: {
            ko: '배포',
            ja: 'デプロイ',
          },
          items: [
            { slug: 'deployment/docker' },
            { slug: 'deployment/kubernetes' },
          ],
        },
        {
          label: 'Configuration',
          translations: {
            ko: '설정',
            ja: '設定',
          },
          items: [
            { slug: 'configuration/overview' },
            { slug: 'configuration/environment-variables' },
            {
              label: 'Basic Configuration',
              translations: {
                ko: '기본 설정',
                ja: '基本設定',
              },
              items: [
                { slug: 'general/theme' },
                { slug: 'general/security' },
                { slug: 'general/language' },
                { slug: 'general/branding' },
              ],
            },
            {
              label: 'Database',
              translations: {
                ko: '데이터베이스',
                ja: 'データベース',
              },
              items: [
                { slug: 'database/sqlite' },
                { slug: 'database/postgresql' },
              ],
            },
            {
              label: 'Authentication',
              translations: {
                ko: '기본 인증',
                ja: '認証',
              },
              items: [
                { slug: 'authentication/email-verification' },
                { slug: 'authentication/password' },
                { slug: 'authentication/totp' },
                { slug: 'authentication/passkey' },
              ],
            },
            {
              label: 'Identity Provider',
              translations: {
                ko: '타사 로그인',
                ja: 'アイデンティティプロバイダー',
              },
              items: [
                { slug: 'oauth/overview' },
                { slug: 'oauth/google' },
                { slug: 'oauth/apple' },
                { slug: 'oauth/github' },
                { slug: 'oauth/others' },
              ],
            },
            {
              label: 'Terms of Service',
              translations: {
                ko: '약관',
                ja: '利用規約',
              },
              items: [
                { slug: 'terms/implicit-flow' },
                { slug: 'terms/explicit-flow' },
              ],
            },
            {
              label: 'Client Integration',
              translations: {
                ko: '클라이언트 연동',
                ja: '連携',
              },
              items: [
                { slug: 'client-integration/overview' },
              ],
            },
          ],
        },
        {
          label: 'Integration',
          translations: {
            ko: '앱 연동',
            ja: 'インテグレーション',
          },
          items: [
            { slug: 'integration/nextjs' },
            { slug: 'integration/react-spa' },
          ],
        },
        {
          label: 'Reference',
          translations: {
            ko: '레퍼런스',
            ja: 'リファレンス',
          },
          items: [
            { slug: 'reference/api' },
            { slug: 'reference/configuration-schema' },
            {
              label: 'Interactive API Docs',
              translations: {
                ko: '인터랙티브 API 문서',
                ja: 'インタラクティブAPIドキュメント',
              },
              link: '/api-reference',
              attrs: { target: '_blank' },
            },
          ],
        },
      ],
    }),
  ],
});

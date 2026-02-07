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
      plugins: [],
      // customCss: ['./src/styles/custom.css'],
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
                ko: '애플리케이션',
                ja: '基本設定',
              },
              items: [
                { slug: 'configuration/general/general' },
                { slug: 'configuration/general/register' },
                { slug: 'configuration/general/security' },
                { slug: 'configuration/general/theme' },
                { slug: 'configuration/general/language' },
                { slug: 'configuration/general/branding' },
              ],
            },
            {
              label: 'Database',
              translations: {
                ko: '데이터베이스',
                ja: 'データベース',
              },
              items: [
                { slug: 'configuration/database/sqlite' },
                { slug: 'configuration/database/postgresql' },
              ],
            },
            {
              label: 'Authentication',
              translations: {
                ko: '기본 인증',
                ja: '認証',
              },
              items: [
                { slug: 'configuration/authentication/password' },
                { slug: 'configuration/authentication/email-verification' },
                { slug: 'configuration/authentication/totp' },
                { slug: 'configuration/authentication/passkey' },
              ],
            },
            {
              label: 'Identity Provider',
              translations: {
                ko: '타사 로그인',
                ja: 'アイデンティティプロバイダー',
              },
              items: [
                { slug: 'configuration/oauth/overview' },
                { slug: 'configuration/oauth/google' },
                { slug: 'configuration/oauth/apple' },
                { slug: 'configuration/oauth/github' },
                { slug: 'configuration/oauth/others' },
              ],
            },
            {
              label: 'Terms of Service',
              translations: {
                ko: '약관',
                ja: '利用規約',
              },
              items: [
                { slug: 'configuration/terms/implicit-flow' },
                { slug: 'configuration/terms/explicit-flow' },
              ],
            },
            {
              label: 'Client Integration',
              translations: {
                ko: '클라이언트 연동',
                ja: '連携',
              },
              items: [
                { slug: 'configuration/client-integration/overview' },
              ],
            },
            {
              label: 'Management',
              translations: {
                ko: '관리',
                ja: '管理',
              },
              items: [
                {
                  label: 'Basic Configuration',
                  translations: {
                    ko: '작업 스케줄러',
                    ja: '基本設定',
                  },
                  slug: 'configuration/scheduler',
                },
              ],
            }
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

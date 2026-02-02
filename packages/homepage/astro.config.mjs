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
        ja: {
          label: '日本語',
          lang: 'ja',
        },
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
            { slug: 'configuration/app' },
            { slug: 'configuration/database' },
            { slug: 'configuration/smtp' },
            { slug: 'configuration/environment-variables' },
          ],
        },
        {
          label: 'Authentication',
          translations: {
            ko: '인증',
            ja: '認証',
          },
          items: [
            { slug: 'authentication/password' },
            { slug: 'authentication/passkey' },
            { slug: 'authentication/totp' },
            { slug: 'authentication/email-verification' },
          ],
        },
        {
          label: 'Guides',
          translations: {
            ko: '가이드',
            ja: 'ガイド',
          },
          autogenerate: { directory: 'guides' },
        },
        {
          label: 'Integration',
          translations: {
            ko: '연동',
            ja: '連携',
          },
          items: [
            { slug: 'integration/nextjs' },
            { slug: 'integration/react-spa' },
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
          label: 'Terms of Service',
          translations: {
            ko: '약관',
            ja: '利用規約',
          },
          items: [
            { slug: 'terms/overview' },
            { slug: 'terms/implicit-flow' },
            { slug: 'terms/explicit-flow' },
          ],
        },
        {
          label: 'Reference',
          translations: {
            ko: '레퍼런스',
            ja: 'リファレンス',
          },
          autogenerate: { directory: 'reference' },
        },
      ],
    }),
  ],
});

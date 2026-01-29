import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
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
            { slug: 'getting-started/installation' },
            { slug: 'getting-started/quick-start' },
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

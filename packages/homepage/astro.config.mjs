import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Tinyrack Auth',
      description: 'OpenID Connect (OIDC) Provider Documentation',
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

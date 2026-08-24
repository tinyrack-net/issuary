import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { loadDocsManifest } from '@tinyrack/docs/config';
import { describe, expect, it } from 'vitest';

import config from '../docs.config.js';

const root = resolve(import.meta.dirname, '..');
const contentRoot = join(root, 'app', 'content');

async function contentFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory()
          ? contentFiles(path)
          : Promise.resolve(entry.name.endsWith('.mdx') ? [path] : []);
      }),
    )
  ).flat();
}

function documentationFiles(locale: string, files: string[]) {
  const localeRoot = join(contentRoot, locale);
  return files.filter((file) => {
    const path = relative(localeRoot, file).replaceAll('\\', '/');
    return (
      !path.includes('../') &&
      !['api-reference.mdx', 'index.mdx'].includes(path)
    );
  });
}

function normalize(source: string) {
  return source.replaceAll('\r\n', '\n');
}

function body(source: string) {
  return normalize(source)
    .replace(/^---\n[\s\S]*?\n---\n/u, '')
    .trim();
}

function fencedCode(source: string) {
  return normalize(source).match(/```[^\n]*\n[\s\S]*?```/gu) ?? [];
}

function inlineCode(source: string) {
  return [...normalize(source).matchAll(/(?<!`)`([^`\n]+)`(?!`)/gu)]
    .map((match) => match[1] ?? '')
    .sort();
}

describe('Issuary documentation contract', () => {
  it('builds 105 localized routes and all three layouts', () => {
    const manifest = loadDocsManifest(config, { root });

    expect(manifest.pages).toHaveLength(105);
    expect(manifest.redirects).toEqual({ '/': '/en/' });
    expect(manifest.locales['ko']?.messages).toMatchObject({
      backToMainMenu: '문서 메뉴로 돌아가기',
      siteNavigation: '메인 메뉴',
      useDarkColorScheme: '어두운 색상 모드로 전환',
      useLightColorScheme: '밝은 색상 모드로 전환',
    });
    expect(manifest.locales['ja']?.messages).toMatchObject({
      backToMainMenu: 'ドキュメントメニューに戻る',
      siteNavigation: 'メインメニュー',
      useDarkColorScheme: 'ダークカラースキームに切り替え',
      useLightColorScheme: 'ライトカラースキームに切り替え',
    });

    const sectionLabels = new Map([
      ['en', 'Getting Started'],
      ['ja', 'はじめに'],
      ['ko', '시작하기'],
    ]);

    for (const locale of ['en', 'ko', 'ja']) {
      const pages = manifest.pages.filter((page) => page.locale === locale);
      expect(pages).toHaveLength(35);
      expect(pages.find((page) => page.path === `/${locale}`)?.layout).toBe(
        'splash',
      );
      expect(
        pages.find((page) => page.path === `/${locale}/api-reference`)?.layout,
      ).toBe('standalone');
      const introduction = pages.find((page) =>
        page.path.endsWith('/getting-started/introduction'),
      );
      expect(introduction?.layout).toBe('docs');
      expect(introduction?.sectionLabel).toBe(sectionLabels.get(locale));
      expect(pages.every((page) => page.alternates.length === 3)).toBe(true);
    }
  });

  it('contains 33 non-empty Japanese documents derived from Korean', async () => {
    const allFiles = await contentFiles(contentRoot);
    const korean = documentationFiles('ko', allFiles);
    const japanese = documentationFiles('ja', allFiles);
    expect(korean).toHaveLength(33);
    expect(japanese).toHaveLength(33);

    const japaneseByPath = new Map(
      japanese.map((file) => [relative(join(contentRoot, 'ja'), file), file]),
    );

    for (const koreanFile of korean) {
      const path = relative(join(contentRoot, 'ko'), koreanFile);
      const japaneseFile = japaneseByPath.get(path);
      expect(japaneseFile, path).toBeDefined();
      if (japaneseFile === undefined) continue;

      const koreanSource = await readFile(koreanFile, 'utf8');
      const japaneseSource = await readFile(japaneseFile, 'utf8');
      expect(body(japaneseSource).length, path).toBeGreaterThan(20);
      expect(body(japaneseSource), path).toMatch(/[ぁ-んァ-ヶ一-龯]/u);
      expect(
        body(japaneseSource).replace(/```[^\n]*\n[\s\S]*?```/gu, ''),
        path,
      ).not.toMatch(/\]\(\/ko\//u);
      expect(japaneseSource, path).not.toMatch(/ZX.*TOKEN/iu);
      expect(fencedCode(japaneseSource), path).toEqual(
        fencedCode(koreanSource),
      );
      expect(inlineCode(japaneseSource), path).toEqual(
        inlineCode(koreanSource),
      );
    }
  });

  it('uses public Tinyrack MDX contracts and valid localized links', async () => {
    const manifest = loadDocsManifest(config, { root });
    const routes = new Set(manifest.pages.map((page) => page.path));
    const files = await contentFiles(contentRoot);
    const violations: string[] = [];
    let callouts = 0;

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      if (/\b@astrojs\/|@scalar\/astro|<(?:Aside|TabItem)>/u.test(source)) {
        violations.push(`${relative(root, file)} uses an Astro component`);
      }
      callouts += [...source.matchAll(/^:::(?:note|caution|tip|danger)$/gmu)]
        .length;

      for (const match of source.matchAll(
        /\]\((\/[^)#?]*)(?:[?#][^)]*)?\)/gu,
      )) {
        const link = match[1];
        if (link === undefined || link === '/openapi.json') continue;
        const normalized = link.replace(/\/+$/u, '') || '/';
        if (!routes.has(normalized)) {
          violations.push(`${relative(root, file)} -> ${link}`);
        }
      }
    }

    expect(callouts).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  }, 30_000);

  it('keeps the generated OpenAPI document available', async () => {
    const source = await readFile(join(root, 'public', 'openapi.json'), 'utf8');
    const document: unknown = JSON.parse(source);
    expect(document).toMatchObject({ openapi: '3.1.0' });
  });
});

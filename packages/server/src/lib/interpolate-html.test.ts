import { describe, expect, test } from 'vitest';
import { BrandingConfigSchema } from './config/branding.ts';
import { ServerConfigSchema } from './config/server.ts';
import {
  DEFAULT_HTML_VARIABLES,
  interpolateHtml,
  interpolateHtmlResponse,
  resolveHtmlVariables,
} from './interpolate-html.ts';

describe('interpolateHtml', () => {
  describe('basic replacement', () => {
    test('should replace {{KEY}} with variable value', () => {
      expect(
        interpolateHtml('<title>{{TITLE}}</title>', {
          TITLE: 'Hello',
        }),
      ).toBe('<title>Hello</title>');
    });

    test('should replace multiple different variables', () => {
      const html = '<p>{{GREETING}} {{NAME}}</p>';
      const result = interpolateHtml(html, {
        GREETING: 'Hello',
        NAME: 'Alice',
      });
      expect(result).toBe('<p>Hello Alice</p>');
    });

    test('should replace duplicate occurrences', () => {
      const html = '{{A}} and {{A}}';
      expect(interpolateHtml(html, { A: 'x' })).toBe('x and x');
    });
  });

  describe('unmatched placeholders', () => {
    test('should leave {{KEY}} as-is when key is not in variables', () => {
      expect(interpolateHtml('{{MISSING}}', {})).toBe('{{MISSING}}');
    });

    test('should replace known keys and leave unknown keys', () => {
      const html = '{{KNOWN}} {{UNKNOWN}}';
      const result = interpolateHtml(html, { KNOWN: 'yes' });
      expect(result).toBe('yes {{UNKNOWN}}');
    });
  });

  describe('non-matching patterns', () => {
    test('should not replace single-brace patterns', () => {
      expect(interpolateHtml('{notavar}', { notavar: 'x' })).toBe('{notavar}');
    });

    test('should not replace triple-brace patterns', () => {
      expect(interpolateHtml('{{{KEY}}}', { KEY: 'x' })).toBe('{x}');
    });

    test('should not replace keys starting with digits', () => {
      expect(interpolateHtml('{{0BAD}}', { '0BAD': 'x' })).toBe('{{0BAD}}');
    });

    test('should not replace keys with hyphens', () => {
      expect(interpolateHtml('{{MY-VAR}}', { 'MY-VAR': 'x' })).toBe(
        '{{MY-VAR}}',
      );
    });

    test('should not replace keys with spaces', () => {
      expect(interpolateHtml('{{ KEY }}', { KEY: 'x' })).toBe('{{ KEY }}');
    });
  });

  describe('key naming rules', () => {
    test('should match keys with underscores', () => {
      expect(interpolateHtml('{{MY_VAR}}', { MY_VAR: 'ok' })).toBe('ok');
    });

    test('should match keys starting with underscore', () => {
      expect(interpolateHtml('{{_PRIVATE}}', { _PRIVATE: 'ok' })).toBe('ok');
    });

    test('should match keys with digits after first char', () => {
      expect(interpolateHtml('{{VAR2}}', { VAR2: 'ok' })).toBe('ok');
    });

    test('should match lowercase keys', () => {
      expect(interpolateHtml('{{lower}}', { lower: 'ok' })).toBe('ok');
    });

    test('should match mixed case keys', () => {
      expect(
        interpolateHtml('{{mixedCase_V2}}', {
          mixedCase_V2: 'ok',
        }),
      ).toBe('ok');
    });
  });

  describe('html context', () => {
    test('should work in attribute values', () => {
      const html = '<img src="{{CDN_URL}}/logo.png" />';
      const result = interpolateHtml(html, {
        CDN_URL: 'https://cdn.example.com',
      });
      expect(result).toBe('<img src="https://cdn.example.com/logo.png" />');
    });

    test('should work inside script tags', () => {
      const html = '<script>window.ID = "{{ANALYTICS_ID}}";</script>';
      const result = interpolateHtml(html, {
        ANALYTICS_ID: 'GA-123',
      });
      expect(result).toBe('<script>window.ID = "GA-123";</script>');
    });

    test('should work in meta tags', () => {
      const html = '<meta name="description" content="{{DESC}}" />';
      const result = interpolateHtml(html, {
        DESC: 'My site',
      });
      expect(result).toBe('<meta name="description" content="My site" />');
    });
  });

  describe('edge cases', () => {
    test('should return empty string for empty html', () => {
      expect(interpolateHtml('', { A: 'x' })).toBe('');
    });

    test('should return html unchanged when variables is empty', () => {
      const html = '<p>{{A}} {{B}}</p>';
      expect(interpolateHtml(html, {})).toBe(html);
    });

    test('should handle empty string as variable value', () => {
      expect(interpolateHtml('{{KEY}}', { KEY: '' })).toBe('');
    });

    test('should handle html-like characters in variable value', () => {
      expect(
        interpolateHtml('{{VAL}}', {
          VAL: '<b>bold</b>',
        }),
      ).toBe('<b>bold</b>');
    });

    test('should handle variable value containing {{}}', () => {
      const result = interpolateHtml('{{A}}', {
        A: '{{B}}',
      });
      expect(result).toBe('{{B}}');
    });
  });
});

describe('resolveHtmlVariables', () => {
  test('returns built-in defaults when no runtime values are provided', () => {
    expect(resolveHtmlVariables({})).toEqual(DEFAULT_HTML_VARIABLES);
    expect(DEFAULT_HTML_VARIABLES['FAVICON_URL']).toBe('/issuary-app-icon.svg');
    expect(DEFAULT_HTML_VARIABLES['APPLE_TOUCH_ICON_URL']).toBe(
      '/issuary-app-icon-512.png',
    );
  });

  test('derives variables from branding and server config', () => {
    const variables = resolveHtmlVariables({
      branding: BrandingConfigSchema.parse({
        icon_url: 'https://example.com/icon.png',
      }),
      server: ServerConfigSchema.parse({
        public_origin: 'https://auth.example.com',
      }),
    });

    expect(variables['COLOR_SCHEME']).toBe('light dark');
    expect(variables['FAVICON_URL']).toBe('https://example.com/icon.png');
    expect(variables['APPLE_TOUCH_ICON_URL']).toBe(
      'https://example.com/icon.png',
    );
    expect(variables['OG_URL']).toBe('https://auth.example.com');
  });

  test('user overrides win over defaults and derived values', () => {
    const variables = resolveHtmlVariables({
      branding: BrandingConfigSchema.parse({
        icon_url: 'https://example.com/default-icon.png',
      }),
      overrides: {
        TITLE: 'Custom Title',
        COLOR_SCHEME: 'dark',
        FAVICON_URL: 'https://example.com/custom-icon.png',
      },
    });

    expect(variables['TITLE']).toBe('Custom Title');
    expect(variables['COLOR_SCHEME']).toBe('dark');
    expect(variables['FAVICON_URL']).toBe(
      'https://example.com/custom-icon.png',
    );
    expect(variables['APPLE_TOUCH_ICON_URL']).toBe(
      'https://example.com/default-icon.png',
    );
  });
});

describe('interpolateHtmlResponse', () => {
  const variables = { TITLE: 'My App', NAME: 'Alice' };

  test('interpolates HTML response body', async () => {
    const response = new Response(
      '<html><title>{{TITLE}}</title><body>{{NAME}}</body></html>',
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
    const result = await interpolateHtmlResponse(response, variables);
    const body = await result.text();
    expect(body).toBe('<html><title>My App</title><body>Alice</body></html>');
  });

  test('updates content-length header', async () => {
    const response = new Response('<title>{{TITLE}}</title>', {
      headers: { 'content-type': 'text/html', 'content-length': '999' },
    });
    const result = await interpolateHtmlResponse(response, variables);
    const body = await result.text();
    const expectedLength = new TextEncoder().encode(body).byteLength;
    expect(result.headers.get('content-length')).toBe(String(expectedLength));
  });

  test('preserves status and statusText', async () => {
    const response = new Response('<p>{{TITLE}}</p>', {
      status: 201,
      statusText: 'Created',
      headers: { 'content-type': 'text/html' },
    });
    const result = await interpolateHtmlResponse(response, variables);
    expect(result.status).toBe(201);
    expect(result.statusText).toBe('Created');
  });

  test('returns non-HTML responses unchanged', async () => {
    const response = new Response('{"key": "{{TITLE}}"}', {
      headers: { 'content-type': 'application/json' },
    });
    const result = await interpolateHtmlResponse(response, variables);
    expect(result).toBe(response);
  });

  test('returns responses without content-type unchanged', async () => {
    const response = new Response('{{TITLE}}');
    const result = await interpolateHtmlResponse(response, variables);
    expect(result).toBe(response);
  });

  test('handles case-insensitive content-type check', async () => {
    const response = new Response('<p>{{TITLE}}</p>', {
      headers: { 'content-type': 'Text/HTML' },
    });
    const result = await interpolateHtmlResponse(response, variables);
    const body = await result.text();
    expect(body).toBe('<p>My App</p>');
  });
});

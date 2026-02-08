import { describe, expect, test } from 'vitest';
import { interpolateHtml } from './interpolate-html.js';

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
      // No recursive replacement — single pass only
      expect(result).toBe('{{B}}');
    });
  });
});

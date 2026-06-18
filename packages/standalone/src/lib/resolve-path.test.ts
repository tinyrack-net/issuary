import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAbsolutePath } from './resolve-path.ts';

const ROOT = path.parse(process.cwd()).root;
const MOCK_CWD = path.resolve(ROOT, 'mock', 'cwd');
const CUSTOM_BASE = path.resolve(ROOT, 'custom', 'base');
const ABSOLUTE_CONFIG_PATH = path.resolve(ROOT, 'etc', 'config.yaml');

describe('resolveAbsolutePath', () => {
  beforeEach(() => {
    vi.spyOn(process, 'cwd').mockReturnValue(MOCK_CWD);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('absolute paths', () => {
    it('returns absolute path as-is', () => {
      expect(resolveAbsolutePath(ABSOLUTE_CONFIG_PATH)).toBe(
        ABSOLUTE_CONFIG_PATH,
      );
    });

    it('returns absolute path as-is even when basePath is provided', () => {
      expect(resolveAbsolutePath(ABSOLUTE_CONFIG_PATH, CUSTOM_BASE)).toBe(
        ABSOLUTE_CONFIG_PATH,
      );
    });
  });

  describe('relative paths', () => {
    it('resolves ./relative against process.cwd()', () => {
      expect(resolveAbsolutePath('./config.yaml')).toBe(
        path.resolve(MOCK_CWD, './config.yaml'),
      );
    });

    it('resolves ../relative against process.cwd()', () => {
      expect(resolveAbsolutePath('../etc/config.yaml')).toBe(
        path.resolve(MOCK_CWD, '../etc/config.yaml'),
      );
    });

    it('resolves ./relative against custom basePath', () => {
      expect(resolveAbsolutePath('./config.yaml', CUSTOM_BASE)).toBe(
        path.resolve(CUSTOM_BASE, './config.yaml'),
      );
    });
  });

  describe('filename-only paths', () => {
    it('resolves filename against process.cwd()', () => {
      expect(resolveAbsolutePath('config.yaml')).toBe(
        path.resolve(MOCK_CWD, 'config.yaml'),
      );
    });

    it('resolves filename against custom basePath', () => {
      expect(resolveAbsolutePath('config.yaml', CUSTOM_BASE)).toBe(
        path.resolve(CUSTOM_BASE, 'config.yaml'),
      );
    });
  });

  describe('edge cases', () => {
    it('resolves empty string against process.cwd()', () => {
      expect(resolveAbsolutePath('')).toBe(path.resolve(MOCK_CWD, ''));
    });

    it('handles basePath with trailing slash', () => {
      const basePathWithTrailingSeparator = `${CUSTOM_BASE}${path.sep}`;

      expect(
        resolveAbsolutePath('config.yaml', basePathWithTrailingSeparator),
      ).toBe(path.resolve(basePathWithTrailingSeparator, 'config.yaml'));
    });
  });
});

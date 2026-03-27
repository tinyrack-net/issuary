import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAbsolutePath } from './resolve-path.ts';

describe('resolveAbsolutePath', () => {
  const MOCK_CWD = '/mock/cwd';

  beforeEach(() => {
    vi.spyOn(process, 'cwd').mockReturnValue(MOCK_CWD);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('absolute paths', () => {
    it('returns absolute path as-is', () => {
      expect(resolveAbsolutePath('/etc/config.yaml')).toBe('/etc/config.yaml');
    });

    it('returns absolute path as-is even when basePath is provided', () => {
      expect(resolveAbsolutePath('/etc/config.yaml', '/other/base')).toBe(
        '/etc/config.yaml',
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
      expect(resolveAbsolutePath('./config.yaml', '/custom/base')).toBe(
        path.resolve('/custom/base', './config.yaml'),
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
      expect(resolveAbsolutePath('config.yaml', '/custom/base')).toBe(
        path.resolve('/custom/base', 'config.yaml'),
      );
    });
  });

  describe('edge cases', () => {
    it('resolves empty string against process.cwd()', () => {
      expect(resolveAbsolutePath('')).toBe(MOCK_CWD);
    });

    it('handles basePath with trailing slash', () => {
      expect(resolveAbsolutePath('config.yaml', '/custom/base/')).toBe(
        path.resolve('/custom/base/', 'config.yaml'),
      );
    });
  });
});

// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Testing env var interpolation requires literal ${} strings
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  test,
} from 'vitest';
import { interpolateEnv, resolveEnvVariables } from './interpolate-env.ts';

describe('interpolateEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all env vars and set test values
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    process.env['HOST'] = 'localhost';
    process.env['PORT'] = '8080';
    process.env['EMPTY'] = '';
    process.env['lower_case'] = 'lowercase_value';
    process.env['MixedCase'] = 'mixed_value';
  });

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  describe('simple $VAR syntax', () => {
    test('should replace $VAR with env value', () => {
      expect(interpolateEnv('$HOST')).toBe('localhost');
      expect(interpolateEnv('$PORT')).toBe('8080');
    });

    test('should return empty string for undefined var', () => {
      expect(interpolateEnv('$UNDEFINED')).toBe('');
    });

    test('should handle empty env value', () => {
      expect(interpolateEnv('$EMPTY')).toBe('');
    });

    test('should handle multiple $VAR in one string', () => {
      expect(interpolateEnv('$HOST:$PORT')).toBe('localhost:8080');
    });

    test('should handle $VAR at start, middle, end', () => {
      expect(interpolateEnv('$HOST/path')).toBe('localhost/path');
      expect(interpolateEnv('https://$HOST/api')).toBe('https://localhost/api');
      expect(interpolateEnv('prefix-$HOST')).toBe('prefix-localhost');
    });

    test('should handle lowercase variable names', () => {
      expect(interpolateEnv('$lower_case')).toBe('lowercase_value');
    });

    test('should handle mixed case variable names', () => {
      expect(interpolateEnv('$MixedCase')).toBe('mixed_value');
    });

    test('should not match invalid variable names', () => {
      expect(interpolateEnv('$123INVALID')).toBe('$123INVALID');
      expect(interpolateEnv('$-INVALID')).toBe('$-INVALID');
    });

    test('should preserve text without variables', () => {
      expect(interpolateEnv('plain text')).toBe('plain text');
      expect(interpolateEnv('')).toBe('');
    });
  });

  describe('${VAR} brace syntax', () => {
    test('should replace ${VAR} with env value', () => {
      expect(interpolateEnv('${HOST}')).toBe('localhost');
      expect(interpolateEnv('${PORT}')).toBe('8080');
    });

    test('should return empty string for undefined var', () => {
      expect(interpolateEnv('${UNDEFINED}')).toBe('');
    });

    test('should allow concatenation: ${VAR}suffix', () => {
      expect(interpolateEnv('${HOST}name')).toBe('localhostname');
      expect(interpolateEnv('prefix${HOST}suffix')).toBe(
        'prefixlocalhostsuffix',
      );
    });

    test('should handle multiple ${VAR} in one string', () => {
      expect(interpolateEnv('${HOST}:${PORT}')).toBe('localhost:8080');
    });
  });

  describe('${VAR:-default} default syntax', () => {
    test('should use env value when set', () => {
      expect(interpolateEnv('${HOST:-fallback}')).toBe('localhost');
      expect(interpolateEnv('${PORT:-9999}')).toBe('8080');
    });

    test('should use default when env not set', () => {
      expect(interpolateEnv('${UNDEFINED:-fallback}')).toBe('fallback');
      expect(interpolateEnv('${MISSING:-default value}')).toBe('default value');
    });

    test('should handle quoted default: ${VAR:-"value"}', () => {
      expect(interpolateEnv('${UNDEFINED:-"quoted value"}')).toBe(
        'quoted value',
      );
      expect(interpolateEnv('${UNDEFINED:-"  spaces  "}')).toBe('  spaces  ');
    });

    test("should handle single-quoted: ${VAR:-'value'}", () => {
      expect(interpolateEnv("${UNDEFINED:-'single quoted'}")).toBe(
        'single quoted',
      );
    });

    test('should handle URL in default: ${VAR:-http://localhost:8080}', () => {
      expect(interpolateEnv('${UNDEFINED:-http://localhost:8080}')).toBe(
        'http://localhost:8080',
      );
      expect(interpolateEnv('${UNDEFINED:-https://example.com:443/path}')).toBe(
        'https://example.com:443/path',
      );
    });

    test('should handle empty default: ${VAR:-}', () => {
      expect(interpolateEnv('${UNDEFINED:-}')).toBe('');
    });

    test('should use empty string over default when env is empty', () => {
      // EMPTY is set to ''
      expect(interpolateEnv('${EMPTY:-fallback}')).toBe('');
    });
  });

  describe('mixed syntax', () => {
    test('should handle both $VAR and ${VAR} in same string', () => {
      expect(interpolateEnv('$HOST and ${PORT}')).toBe('localhost and 8080');
    });

    test('should handle complex URLs', () => {
      expect(interpolateEnv('https://${HOST}:${PORT:-443}/api/$HOST/v1')).toBe(
        'https://localhost:8080/api/localhost/v1',
      );
    });

    test('should handle path construction', () => {
      process.env['DATA_DIR'] = '/var/data';
      expect(interpolateEnv('$DATA_DIR/subdir/file.db')).toBe(
        '/var/data/subdir/file.db',
      );
    });
  });
});

describe('resolveEnvVariables', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    process.env['HOST'] = 'localhost';
    process.env['PORT'] = '8080';
    process.env['SECRET'] = 'my-secret';
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  test('should resolve strings', () => {
    expect(resolveEnvVariables('$HOST')).toBe('localhost');
  });

  test('should resolve nested objects', () => {
    const input = {
      server: {
        host: '$HOST',
        port: '${PORT:-3000}',
      },
      auth: {
        secret: '$SECRET',
      },
    };

    const expected = {
      server: {
        host: 'localhost',
        port: '8080',
      },
      auth: {
        secret: 'my-secret',
      },
    };

    expect(resolveEnvVariables(input)).toEqual(expected);
  });

  test('should resolve arrays', () => {
    const input = ['$HOST', '$PORT', '${UNDEFINED:-default}'];
    const expected = ['localhost', '8080', 'default'];
    expect(resolveEnvVariables(input)).toEqual(expected);
  });

  test('should resolve arrays in objects', () => {
    const input = {
      hosts: ['$HOST', '${HOST}:${PORT}'],
    };
    const expected = {
      hosts: ['localhost', 'localhost:8080'],
    };
    expect(resolveEnvVariables(input)).toEqual(expected);
  });

  test('should preserve numbers', () => {
    expect(resolveEnvVariables(123)).toBe(123);
    expect(resolveEnvVariables(3.14)).toBe(3.14);
    expect(resolveEnvVariables({ port: 8080 })).toEqual({ port: 8080 });
  });

  test('should preserve booleans', () => {
    expect(resolveEnvVariables(true)).toBe(true);
    expect(resolveEnvVariables(false)).toBe(false);
    expect(resolveEnvVariables({ enabled: true })).toEqual({
      enabled: true,
    });
  });

  test('should preserve null', () => {
    expect(resolveEnvVariables(null)).toBe(null);
    expect(resolveEnvVariables({ value: null })).toEqual({ value: null });
  });

  test('should preserve undefined', () => {
    expect(resolveEnvVariables(undefined)).toBe(undefined);
  });

  test('should handle deeply nested structures', () => {
    const input = {
      level1: {
        level2: {
          level3: {
            value: '$HOST:$PORT',
          },
        },
      },
    };

    const expected = {
      level1: {
        level2: {
          level3: {
            value: 'localhost:8080',
          },
        },
      },
    };

    expect(resolveEnvVariables(input)).toEqual(expected);
  });

  test('should handle mixed types in objects', () => {
    const input = {
      host: '$HOST',
      port: 8080,
      enabled: true,
      tags: ['$HOST', 'static'],
      config: null,
    };

    const expected = {
      host: 'localhost',
      port: 8080,
      enabled: true,
      tags: ['localhost', 'static'],
      config: null,
    };

    expect(resolveEnvVariables(input)).toEqual(expected);
  });

  describe('type inference', () => {
    test('should infer string for string input', () => {
      const result = resolveEnvVariables('$HOST');
      expectTypeOf(result).toEqualTypeOf<string>();
    });

    test('should infer number for number input', () => {
      const result = resolveEnvVariables(123);
      expectTypeOf(result).toEqualTypeOf<number>();
    });

    test('should infer boolean for boolean input', () => {
      const result = resolveEnvVariables(true);
      expectTypeOf(result).toEqualTypeOf<boolean>();
    });

    test('should infer null for null input', () => {
      const result = resolveEnvVariables(null);
      expectTypeOf(result).toEqualTypeOf<null>();
    });

    test('should infer string[] for string array input', () => {
      const result = resolveEnvVariables(['$HOST', '$PORT']);
      expectTypeOf(result).toEqualTypeOf<string[]>();
    });

    test('should preserve object structure', () => {
      const input = {
        host: '$HOST',
        port: 8080,
        enabled: true,
      };
      const result = resolveEnvVariables(input);
      expectTypeOf(result).toEqualTypeOf<{
        host: string;
        port: number;
        enabled: boolean;
      }>();
    });

    test('should preserve nested object structure', () => {
      const input = {
        server: {
          host: '$HOST',
          port: 8080,
        },
        tags: ['$HOST'],
      };
      const result = resolveEnvVariables(input);
      expectTypeOf(result).toEqualTypeOf<{
        server: { host: string; port: number };
        tags: string[];
      }>();
    });
  });
});

import { describe, expect, it } from 'vitest';
import { type DeepPartial, deepMerge } from './deep-merge.js';

describe('deepMerge', () => {
  describe('basic merging', () => {
    it('should merge flat objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      const result = deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should return a new object (not mutate target)', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3 };
      const result = deepMerge(target, source);

      expect(result).not.toBe(target);
      expect(target).toEqual({ a: 1, b: 2 });
    });

    it('should handle empty source object', () => {
      const target = { a: 1, b: 2 };
      const source = {};
      const result = deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should handle empty target object', () => {
      const target = {};
      const source = { a: 1, b: 2 };
      const result = deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe('nested object merging', () => {
    it('should deep merge nested objects', () => {
      const target = {
        level1: {
          a: 1,
          b: 2,
        },
      };
      const source = {
        level1: {
          b: 3,
          c: 4,
        },
      };
      const result = deepMerge(target, source);

      expect(result).toEqual({
        level1: {
          a: 1,
          b: 3,
          c: 4,
        },
      });
    });

    it('should deep merge multiple levels of nesting', () => {
      const target = {
        level1: {
          level2: {
            level3: {
              a: 1,
              b: 2,
            },
          },
        },
      };
      const source = {
        level1: {
          level2: {
            level3: {
              b: 3,
              c: 4,
            },
          },
        },
      };
      const result = deepMerge(target, source);

      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              a: 1,
              b: 3,
              c: 4,
            },
          },
        },
      });
    });

    it('should preserve nested objects from target when not in source', () => {
      const target = {
        level1: {
          nested: { a: 1, b: 2 },
          preserved: { x: 10, y: 20 },
        },
      };
      const source = {
        level1: {
          nested: { b: 3, c: 4 },
        },
      };
      const result = deepMerge(target, source);

      expect(result).toEqual({
        level1: {
          nested: { a: 1, b: 3, c: 4 },
          preserved: { x: 10, y: 20 },
        },
      });
    });
  });

  describe('array handling', () => {
    it('should replace arrays (not merge them)', () => {
      const target = { arr: [1, 2, 3] };
      const source = { arr: [4, 5] };
      const result = deepMerge(target, source);

      expect(result).toEqual({ arr: [4, 5] });
    });

    it('should replace nested arrays', () => {
      const target = {
        level1: {
          arr: ['a', 'b', 'c'],
        },
      };
      const source = {
        level1: {
          arr: ['x', 'y'],
        },
      };
      const result = deepMerge(target, source);

      expect(result).toEqual({
        level1: {
          arr: ['x', 'y'],
        },
      });
    });

    it('should replace array with empty array', () => {
      const target = { arr: [1, 2, 3] };
      const source = { arr: [] as number[] };
      const result = deepMerge(target, source);

      expect(result).toEqual({ arr: [] });
    });

    it('should handle arrays of objects (replace, not merge)', () => {
      const target = { items: [{ id: 1, name: 'a' }] };
      const source = {
        items: [
          { id: 2, name: 'b' },
          { id: 3, name: 'c' },
        ],
      };
      const result = deepMerge(target, source);

      expect(result).toEqual({
        items: [
          { id: 2, name: 'b' },
          { id: 3, name: 'c' },
        ],
      });
    });

    it('should not treat arrays in target as objects to merge into', () => {
      const target = { data: [1, 2, 3] };
      const source = { data: { 0: 'a' } as unknown as number[] };
      const result = deepMerge(target, source);

      // Arrays in target should be replaced, not treated as objects
      expect(result).toEqual({ data: { 0: 'a' } });
    });
  });

  describe('null and undefined handling', () => {
    it('should ignore undefined values in source', () => {
      const target = { a: 1, b: 2 };
      const source = { a: undefined, b: 3 } as unknown as DeepPartial<
        typeof target
      >;
      const result = deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 3 });
    });

    it('should overwrite with null values', () => {
      const target = { a: 1, b: 2 };
      const source = { a: null } as unknown as DeepPartial<typeof target>;
      const result = deepMerge(target, source);

      expect(result).toEqual({ a: null, b: 2 });
    });

    it('should not deep merge into null target values', () => {
      const target = { nested: null as unknown as { a: number } };
      const source = { nested: { a: 1, b: 2 } };
      const result = deepMerge(target, source);

      expect(result).toEqual({ nested: { a: 1, b: 2 } });
    });

    it('should handle nested undefined values', () => {
      const target = {
        level1: {
          a: 1,
          b: 2,
        },
      };
      const source = {
        level1: {
          a: undefined,
          b: 3,
        },
      } as unknown as DeepPartial<typeof target>;
      const result = deepMerge(target, source);

      expect(result).toEqual({
        level1: {
          a: 1,
          b: 3,
        },
      });
    });
  });

  describe('type handling', () => {
    it('should handle string values', () => {
      const target = { name: 'original' };
      const source = { name: 'updated' };
      const result = deepMerge(target, source);

      expect(result).toEqual({ name: 'updated' });
    });

    it('should handle boolean values', () => {
      const target = { enabled: true, disabled: false };
      const source = { enabled: false, disabled: true };
      const result = deepMerge(target, source);

      expect(result).toEqual({ enabled: false, disabled: true });
    });

    it('should handle number values including zero', () => {
      const target = { count: 10, value: 5 };
      const source = { count: 0, value: -1 };
      const result = deepMerge(target, source);

      expect(result).toEqual({ count: 0, value: -1 });
    });

    it('should handle mixed types in nested objects', () => {
      const target = {
        config: {
          name: 'app',
          version: 1,
          enabled: true,
          tags: ['a', 'b'],
        },
      };
      const source = {
        config: {
          version: 2,
          enabled: false,
          tags: ['c'],
        },
      };
      const result = deepMerge(target, source);

      expect(result).toEqual({
        config: {
          name: 'app',
          version: 2,
          enabled: false,
          tags: ['c'],
        },
      });
    });
  });

  describe('config-like scenarios', () => {
    it('should merge typical app configuration', () => {
      const defaultConfig = {
        app: {
          name: 'MyApp',
          host: 'http://localhost:3000',
          port: 3000,
        },
        database: {
          type: 'sqlite',
          path: '/data/db.sqlite',
        },
        features: {
          auth: true,
          logging: true,
        },
      };

      const userConfig = {
        app: {
          host: 'https://example.com',
          port: 8080,
        },
        database: {
          type: 'postgres',
        },
      };

      const result = deepMerge(defaultConfig, userConfig);

      expect(result).toEqual({
        app: {
          name: 'MyApp',
          host: 'https://example.com',
          port: 8080,
        },
        database: {
          type: 'postgres',
          path: '/data/db.sqlite',
        },
        features: {
          auth: true,
          logging: true,
        },
      });
    });

    it('should handle OAuth client configuration merge', () => {
      const defaultConfig = {
        clients: [{ id: 'default', secret: 'xxx' }],
        scopes: ['openid', 'profile'],
      };

      const userConfig = {
        clients: [
          { id: 'client1', secret: 'abc' },
          { id: 'client2', secret: 'def' },
        ],
      };

      const result = deepMerge(defaultConfig, userConfig);

      // Arrays should be replaced
      expect(result).toEqual({
        clients: [
          { id: 'client1', secret: 'abc' },
          { id: 'client2', secret: 'def' },
        ],
        scopes: ['openid', 'profile'],
      });
    });

    it('should merge SMTP configuration', () => {
      const defaultConfig = {
        smtp: {
          host: 'localhost',
          port: 25,
          secure: false,
        },
      };

      const userConfig = {
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          secure: true,
          user: 'user@example.com',
          password: 'secret',
        },
      };

      const result = deepMerge(defaultConfig, userConfig);

      expect(result).toEqual({
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          secure: true,
          user: 'user@example.com',
          password: 'secret',
        },
      });
    });
  });

  describe('edge cases', () => {
    it('should handle source with keys not in target', () => {
      const target = { a: 1 };
      const source = { b: 2, c: 3 } as unknown as DeepPartial<typeof target>;
      const result = deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should handle deeply nested new properties', () => {
      const target = {
        level1: {
          existing: 1,
        },
      };
      const source = {
        level1: {
          newProp: {
            nested: {
              value: 42,
            },
          },
        },
      } as unknown as DeepPartial<typeof target>;
      const result = deepMerge(target, source);

      expect(result).toEqual({
        level1: {
          existing: 1,
          newProp: {
            nested: {
              value: 42,
            },
          },
        },
      });
    });

    it('should handle Date objects (deep merges them as objects)', () => {
      // Note: Date objects are treated as plain objects and merged,
      // which results in an empty object since Date has no own properties.
      // This is a known limitation - use primitives or stringify dates.
      const target = { date: new Date('2024-01-01') };
      const source = { date: new Date('2025-06-15') };
      const result = deepMerge(target, source);

      // Date objects get merged as plain objects (losing Date functionality)
      expect(result.date).toEqual({});
    });

    it('should handle RegExp objects (deep merges them as objects)', () => {
      // Note: RegExp objects are treated as plain objects and merged,
      // which results in an empty object since RegExp has no own properties.
      // This is a known limitation.
      const target = { pattern: /abc/ };
      const source = { pattern: /xyz/i };
      const result = deepMerge(target, source);

      // RegExp objects get merged as plain objects (losing RegExp functionality)
      expect(result.pattern).toEqual({});
    });

    it('should handle functions (replace, not merge)', () => {
      const fn1 = () => 1;
      const fn2 = () => 2;
      const target = { handler: fn1 };
      const source = { handler: fn2 };
      const result = deepMerge(target, source);

      expect(result.handler).toBe(fn2);
    });

    it('should handle symbols as values', () => {
      const sym1 = Symbol('a');
      const sym2 = Symbol('b');
      const target = { sym: sym1 };
      const source = { sym: sym2 };
      const result = deepMerge(target, source);

      expect(result.sym).toBe(sym2);
    });

    it('should handle empty string values', () => {
      const target = { name: 'original' };
      const source = { name: '' };
      const result = deepMerge(target, source);

      expect(result).toEqual({ name: '' });
    });

    it('should handle NaN values', () => {
      const target = { value: 10 };
      const source = { value: Number.NaN };
      const result = deepMerge(target, source);

      expect(Number.isNaN(result.value)).toBe(true);
    });

    it('should handle Infinity values', () => {
      const target = { max: 100 };
      const source = { max: Infinity };
      const result = deepMerge(target, source);

      expect(result).toEqual({ max: Infinity });
    });
  });

  describe('special property handling', () => {
    it('should copy __proto__ as a regular property (JSON.parse creates own property)', () => {
      // Note: JSON.parse creates __proto__ as an own property, not as prototype
      // This tests that the function handles this edge case
      const target = { a: 1 };
      const malicious = JSON.parse(
        '{"__proto__": {"polluted": true}}',
      ) as DeepPartial<{ a: number }>;
      const result = deepMerge(target, malicious);

      // The __proto__ property is merged as a regular property
      // This is expected behavior since JSON.parse creates it as an own property
      expect(
        (result as unknown as Record<string, unknown>)['__proto__'],
      ).toEqual({ polluted: true });
    });

    it('should handle constructor property (overwrites with source value)', () => {
      // Note: constructor is a regular property and gets overwritten
      const target = { a: 1 };
      const source = { constructor: { name: 'Evil' } };
      const result = deepMerge(
        target,
        source as unknown as DeepPartial<typeof target>,
      );

      // constructor gets overwritten with the source value
      expect(typeof result.constructor).toBe('object');
      expect(
        (result.constructor as unknown as Record<string, string>)['name'],
      ).toBe('Evil');
    });
  });

  describe('immutability', () => {
    it('should not mutate nested objects in target', () => {
      const nested = { a: 1, b: 2 };
      const target = { nested };
      const source = { nested: { b: 3 } };
      const result = deepMerge(target, source);

      expect(nested).toEqual({ a: 1, b: 2 });
      expect(result.nested).not.toBe(nested);
    });

    it('should not mutate arrays in target', () => {
      const arr = [1, 2, 3];
      const target = { arr };
      const source = { arr: [4, 5] };
      const result = deepMerge(target, source);

      expect(arr).toEqual([1, 2, 3]);
      expect(result.arr).not.toBe(arr);
    });

    it('should not mutate deeply nested objects', () => {
      const deep = { value: 42 };
      const target = {
        level1: {
          level2: {
            deep,
          },
        },
      };
      const source = {
        level1: {
          level2: {
            deep: { value: 100 },
          },
        },
      };
      const result = deepMerge(target, source);

      expect(deep).toEqual({ value: 42 });
      expect(result.level1.level2.deep.value).toBe(100);
    });
  });

  describe('TypeScript type inference', () => {
    it('should maintain type safety with DeepPartial', () => {
      interface Config {
        app: {
          name: string;
          port: number;
        };
        db: {
          host: string;
          port: number;
        };
      }

      const target: Config = {
        app: { name: 'test', port: 3000 },
        db: { host: 'localhost', port: 5432 },
      };

      const source: DeepPartial<Config> = {
        app: { port: 8080 },
      };

      const result = deepMerge(target, source);

      // Type should be Config
      expect(result.app.name).toBe('test');
      expect(result.app.port).toBe(8080);
      expect(result.db.host).toBe('localhost');
      expect(result.db.port).toBe(5432);
    });
  });
});

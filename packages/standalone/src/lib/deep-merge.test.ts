import { describe, expect, test } from 'vitest';
import { deepMerge } from './deep-merge.ts';

describe('deepMerge', () => {
  test('merges flat objects', () => {
    const target = { a: '1', b: '2' };
    const source = { b: '3', c: '4' };
    expect(deepMerge(target, source)).toEqual({ a: '1', b: '3', c: '4' });
  });

  test('merges nested objects recursively', () => {
    const target = { server: { port: '8080', host: 'localhost' } };
    const source = { server: { port: '3000' } };
    expect(deepMerge(target, source)).toEqual({
      server: { port: '3000', host: 'localhost' },
    });
  });

  test('replaces arrays instead of merging', () => {
    const target = { items: ['a', 'b'] };
    const source = { items: ['c'] };
    expect(deepMerge(target, source)).toEqual({ items: ['c'] });
  });

  test('replaces primitives', () => {
    const target = { count: 1 };
    const source = { count: 2 };
    expect(deepMerge(target, source)).toEqual({ count: 2 });
  });

  test('source null replaces target object', () => {
    const target = { nested: { a: 1 } } as Record<string, unknown>;
    const source = { nested: null };
    expect(deepMerge(target, source)).toEqual({ nested: null });
  });

  test('replaces entire sub-object when source has a type field (discriminated union)', () => {
    const target = {
      database: { type: 'sqlite', path: '/opt/db.sqlite', test: 'false' },
    };
    const source = {
      database: {
        type: 'postgres',
        host: 'db.example.com',
        port: '5432',
        user: 'admin',
        password: 'secret',
        name: 'mydb',
      },
    };
    expect(deepMerge(target, source)).toEqual({
      database: {
        type: 'postgres',
        host: 'db.example.com',
        port: '5432',
        user: 'admin',
        password: 'secret',
        name: 'mydb',
      },
    });
  });

  test('does not mutate original target', () => {
    const target = { server: { port: '8080' } };
    const source = { server: { port: '3000' } };
    deepMerge(target, source);
    expect(target.server.port).toBe('8080');
  });

  test('preserves keys not in source', () => {
    const target = { a: 1, b: 2, c: 3 };
    const source = { b: 20 };
    expect(deepMerge(target, source)).toEqual({ a: 1, b: 20, c: 3 });
  });
});

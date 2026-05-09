/// <reference types="@cloudflare/workers-types" />
import type { MikroORM } from '@mikro-orm/core';
import { describe, expect, test, vi } from 'vitest';
import { d1 } from './d1.ts';

function createMockOrm(): MikroORM {
  return {
    migrator: {
      up: vi.fn(async () => undefined),
    },
  } as unknown as MikroORM;
}

describe('d1 database adapter', () => {
  test('runs MikroORM migrations during initialization', async () => {
    const orm = createMockOrm();
    const config = d1({ database: {} as D1Database });

    await config.initialize(orm);

    expect(orm.migrator.up).toHaveBeenCalledOnce();
  });
});

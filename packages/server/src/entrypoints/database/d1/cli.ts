/// <reference types="@cloudflare/workers-types" />
import { d1 } from './d1.ts';

export default await d1({
  database: {
    exec: async () => ({
      results: [],
      success: true,
      meta: { changed_db: false },
    }),
    prepare: () => ({
      bind: function () {
        return this;
      },
      first: async () => null,
      run: async () => ({
        results: [],
        success: true,
        meta: { changed_db: false },
      }),
      all: async () => ({
        results: [],
        success: true,
        meta: { changed_db: false },
      }),
      raw: async () => ({
        results: [],
        success: true,
        meta: { changed_db: false },
      }),
    }),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    withSession: function () {
      return this;
    },
  } as unknown as D1Database,
}).getMikroOrmOptions();

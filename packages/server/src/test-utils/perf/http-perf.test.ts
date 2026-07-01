import { describe, expect, it } from 'vitest';

import { runHttpPerf } from './http-perf.js';

describe('runHttpPerf', () => {
  it('runs exactly warmupRequests + requests calls', async () => {
    let calls = 0;

    await runHttpPerf({
      name: 'login',
      warmupRequests: 3,
      requests: 5,
      concurrency: 2,
      request: async () => {
        calls += 1;
        return new Response(null, { status: 200 });
      },
    });

    expect(calls).toBe(8);
  });

  it('throws warmup request failures instead of counting them', async () => {
    let calls = 0;

    await expect(
      runHttpPerf({
        name: 'login',
        warmupRequests: 1,
        requests: 3,
        concurrency: 2,
        request: async () => {
          calls += 1;
          throw new Error('warmup failed');
        },
      }),
    ).rejects.toThrow('warmup failed');

    expect(calls).toBe(1);
  });

  it('excludes warmup calls from totalRequests and status counts', async () => {
    let calls = 0;

    const result = await runHttpPerf({
      name: 'login',
      warmupRequests: 2,
      requests: 3,
      concurrency: 2,
      request: async () => {
        calls += 1;
        return new Response(null, { status: calls <= 2 ? 500 : 200 });
      },
    });

    expect(result.totalRequests).toBe(3);
    expect(result.statusCounts).toEqual({ 200: 3 });
    expect(result.success).toBe(3);
    expect(result.failed).toBe(0);
  });

  it('counts successful 200 responses', async () => {
    const result = await runHttpPerf({
      name: 'login',
      requests: 4,
      concurrency: 2,
      request: async () => new Response(null, { status: 200 }),
    });

    expect(result.totalRequests).toBe(4);
    expect(result.success).toBe(4);
    expect(result.failed).toBe(0);
    expect(result.statusCounts).toEqual({ 200: 4 });
  });

  it('counts configured expected statuses as successful responses', async () => {
    const result = await runHttpPerf({
      name: 'authorize redirect',
      requests: 4,
      concurrency: 2,
      expectedStatuses: [302],
      request: async () => new Response(null, { status: 302 }),
    });

    expect(result.totalRequests).toBe(4);
    expect(result.success).toBe(4);
    expect(result.failed).toBe(0);
    expect(result.statusCounts).toEqual({ 302: 4 });
  });

  it('counts mixed 200/401/500 statuses', async () => {
    const statuses = [200, 401, 500, 200];
    let index = 0;

    const result = await runHttpPerf({
      name: 'login',
      requests: statuses.length,
      concurrency: 2,
      request: async () => {
        const status = statuses[index] ?? 500;
        index += 1;
        return new Response(null, { status });
      },
    });

    expect(result.success).toBe(2);
    expect(result.failed).toBe(2);
    expect(result.statusCounts).toEqual({ 200: 2, 401: 1, 500: 1 });
  });

  it('counts thrown request errors as failures', async () => {
    let calls = 0;

    const result = await runHttpPerf({
      name: 'login',
      requests: 3,
      concurrency: 2,
      request: async () => {
        calls += 1;

        if (calls === 2) {
          throw new Error('request failed');
        }

        return new Response(null, { status: 200 });
      },
    });

    expect(result.totalRequests).toBe(3);
    expect(result.success).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.statusCounts).toEqual({ 200: 2 });
  });

  it('honors concurrency by reaching the configured number of simultaneous measured requests', async () => {
    const waiters: Array<() => void> = [];
    let active = 0;
    let maxActive = 0;
    let started = 0;

    const resultPromise = runHttpPerf({
      name: 'login',
      requests: 4,
      concurrency: 3,
      request: async () => {
        started += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);

        await new Promise<void>((resolve) => {
          waiters.push(resolve);
        });

        active -= 1;
        return new Response(null, { status: 200 });
      },
    });

    await expect.poll(() => started).toBe(3);
    expect(maxActive).toBe(3);

    for (const resolve of waiters.splice(0)) {
      resolve();
    }

    await expect.poll(() => started).toBe(4);

    for (const resolve of waiters.splice(0)) {
      resolve();
    }

    const result = await resultPromise;

    expect(result.totalRequests).toBe(4);
    expect(result.success).toBe(4);
  });

  it('returns safe zeros for requests: 0', async () => {
    let calls = 0;

    const result = await runHttpPerf({
      name: 'empty',
      requests: 0,
      concurrency: 4,
      request: async () => {
        calls += 1;
        return new Response(null, { status: 200 });
      },
    });

    expect(calls).toBe(0);
    expect(result).toEqual({
      name: 'empty',
      totalRequests: 0,
      success: 0,
      failed: 0,
      rps: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
      errorRate: 0,
      statusCounts: {},
    });
  });

  it('normalizes concurrency: 0 to one worker', async () => {
    const waiters: Array<() => void> = [];
    let active = 0;
    let maxActive = 0;
    let started = 0;

    const resultPromise = runHttpPerf({
      name: 'login',
      requests: 2,
      concurrency: 0,
      request: async () => {
        started += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);

        await new Promise<void>((resolve) => {
          waiters.push(resolve);
        });

        active -= 1;
        return new Response(null, { status: 200 });
      },
    });

    await expect.poll(() => started).toBe(1);
    expect(maxActive).toBe(1);

    for (const resolve of waiters.splice(0)) {
      resolve();
    }

    await expect.poll(() => started).toBe(2);
    expect(maxActive).toBe(1);

    for (const resolve of waiters.splice(0)) {
      resolve();
    }

    const result = await resultPromise;

    expect(result.totalRequests).toBe(2);
    expect(result.success).toBe(2);
  });
});

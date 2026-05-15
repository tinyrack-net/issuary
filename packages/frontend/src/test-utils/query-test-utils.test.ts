import { afterEach, describe, expect, test } from 'vitest';
import {
  firstRequest,
  jsonRequestBody,
  mockJsonResponses,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';

afterEach(() => {
  resetFetchMock();
});

describe('mockJsonResponses', () => {
  test('matches queued responses by expected URL and method', async () => {
    mockJsonResponses({
      url: '/api/login',
      method: 'POST',
      body: { ok: true },
    });

    const response = await fetch('/api/login', { method: 'POST' });

    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  test('captures JSON body from Request input', async () => {
    const fetchMock = mockJsonResponses({
      url: '/api/passkeys/passkey-1',
      method: 'PATCH',
      body: { ok: true },
    });

    const response = await fetch(
      new Request('/api/passkeys/passkey-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Security Key' }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(jsonRequestBody(firstRequest(fetchMock.requests))).toEqual({
      name: 'Security Key',
    });
  });

  test('throws when queued endpoint expectation does not match', async () => {
    mockJsonResponses({
      url: '/api/login',
      method: 'POST',
      body: { ok: true },
    });

    await expect(fetch('/api/session', { method: 'GET' })).rejects.toThrow(
      'Expected fetch URL /api/login but received /api/session',
    );
  });

  test('asserts that all queued responses were consumed', async () => {
    const fetchMock = mockJsonResponses(
      { url: '/api/session', method: 'GET', body: { ok: true } },
      { url: '/api/profile', method: 'GET', body: { ok: true } },
    );

    await fetch('/api/session', { method: 'GET' });

    expect(fetchMock.getConsumedResponseCount()).toBe(1);
    expect(fetchMock.getPendingResponseCount()).toBe(1);
    expect(() => fetchMock.assertAllResponsesConsumed()).toThrow(
      'Expected all mocked JSON responses to be consumed, but 1 response remains queued',
    );

    await fetch('/api/profile', { method: 'GET' });

    expect(fetchMock.getConsumedResponseCount()).toBe(2);
    expect(fetchMock.getPendingResponseCount()).toBe(0);
    expect(() => fetchMock.assertAllResponsesConsumed()).not.toThrow();
  });
});

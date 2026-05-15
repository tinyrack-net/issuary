import {
  type MutationFunctionContext,
  QueryClient,
  type QueryFunctionContext,
  type QueryKey,
} from '@tanstack/react-query';
import { vi } from 'vitest';

export type CapturedFetchRequest = {
  url: string;
  method: string;
  headers: Headers;
  body: BodyInit | null | undefined;
};

type FetchMock = {
  requests: CapturedFetchRequest[];
};

type JsonResponsesFetchMock = FetchMock & {
  getConsumedResponseCount: () => number;
  getPendingResponseCount: () => number;
  assertAllResponsesConsumed: () => void;
};

type MockJsonResponse = {
  body: unknown;
  init?: ResponseInit;
  url?: string;
  method?: string;
};

const originalFetch = globalThis.fetch;

async function captureRequest(input: RequestInfo | URL, init?: RequestInit) {
  const inputRequestBody =
    input instanceof Request && init?.body === undefined
      ? await input.clone().text()
      : undefined;
  const request = new Request(input, init);
  return {
    url: request.url.replace(globalThis.location.origin, ''),
    method: request.method,
    headers: request.headers,
    body: request.body
      ? await request.clone().text()
      : inputRequestBody || init?.body,
  };
}

function mockFetch(
  handler: (
    request: CapturedFetchRequest,
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Response | Promise<Response>,
) {
  const requests: CapturedFetchRequest[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = await captureRequest(input, init);
      requests.push(request);
      return await handler(request, input, init);
    }),
  );

  return { requests };
}

export function mockJsonSuccess(
  body: unknown,
  init: ResponseInit = {},
): FetchMock {
  return mockFetch(() => {
    return Response.json(body, { status: 200, ...init });
  });
}

export function mockJsonError(
  body: { code: string; message: string },
  status: number,
): FetchMock {
  return mockFetch(() => {
    return Response.json(body, { status });
  });
}

export function mockJsonResponses(
  ...responses: MockJsonResponse[]
): JsonResponsesFetchMock {
  let responseIndex = 0;

  const fetchMock = mockFetch((request) => {
    const response = responses[responseIndex];

    if (!response) {
      throw new Error('No mocked JSON response queued for fetch call');
    }

    if (response.url && request.url !== response.url) {
      throw new Error(
        `Expected fetch URL ${response.url} but received ${request.url}`,
      );
    }

    if (response.method && request.method !== response.method.toUpperCase()) {
      throw new Error(
        `Expected fetch method ${response.method.toUpperCase()} but received ${request.method}`,
      );
    }

    responseIndex += 1;
    return Response.json(response.body, { status: 200, ...response.init });
  });

  return {
    ...fetchMock,
    getConsumedResponseCount: () => responseIndex,
    getPendingResponseCount: () => responses.length - responseIndex,
    assertAllResponsesConsumed: () => {
      const pendingResponses = responses.length - responseIndex;
      if (pendingResponses > 0) {
        const responseLabel = pendingResponses === 1 ? 'response' : 'responses';
        const verb = pendingResponses === 1 ? 'remains' : 'remain';
        throw new Error(
          `Expected all mocked JSON responses to be consumed, but ${pendingResponses} ${responseLabel} ${verb} queued`,
        );
      }
    },
  };
}

export function mockNetworkError(error: Error): FetchMock {
  const requests: CapturedFetchRequest[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(await captureRequest(input, init));
      throw error;
    }),
  );

  return { requests };
}

export function mockPendingResponse(): FetchMock {
  const requests: CapturedFetchRequest[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(await captureRequest(input, init));
      return new Promise<Response>(() => undefined);
    }),
  );

  return { requests };
}

export function queryFunctionContext<TQueryKey extends QueryKey>(
  queryKey: TQueryKey,
): QueryFunctionContext<TQueryKey> {
  return {
    client: new QueryClient(),
    queryKey,
    signal: new AbortController().signal,
    meta: undefined,
  };
}

export function mutationFunctionContext(): MutationFunctionContext {
  return {
    client: new QueryClient(),
    meta: undefined,
  };
}

export function firstRequest(requests: CapturedFetchRequest[]) {
  const request = requests[0];

  if (!request) {
    throw new Error('Expected fetch to be called');
  }

  return request;
}

export function jsonRequestBody(request: CapturedFetchRequest) {
  if (typeof request.body !== 'string') {
    throw new Error('Expected request body to be serialized JSON');
  }

  return JSON.parse(request.body);
}

export function resetFetchMock(): void {
  vi.stubGlobal('fetch', originalFetch);
}

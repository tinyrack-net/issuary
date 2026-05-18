import { vi } from 'vitest';

export type CapturedFetchRequest = {
  url: string;
  method: string;
  headers: Headers;
  body: BodyInit | null | undefined;
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
  } satisfies CapturedFetchRequest;
}

export function mockJsonResponses(...responses: MockJsonResponse[]) {
  const requests: CapturedFetchRequest[] = [];
  let responseIndex = 0;

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = await captureRequest(input, init);
      const response = responses[responseIndex];
      requests.push(request);

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
    }),
  );

  return {
    requests,
    assertAllResponsesConsumed: () => {
      const pendingResponses = responses.length - responseIndex;
      if (pendingResponses > 0) {
        throw new Error(
          `Expected all mocked JSON responses to be consumed, but ${pendingResponses} remain queued`,
        );
      }
    },
  };
}

export function resetFetchMock(): void {
  vi.stubGlobal('fetch', originalFetch);
}

export function jsonRequestBody(request: CapturedFetchRequest) {
  if (typeof request.body !== 'string') {
    throw new Error('Expected request body to be a JSON string');
  }

  return JSON.parse(request.body);
}

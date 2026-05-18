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

function responseMatches(
  response: MockJsonResponse,
  request: CapturedFetchRequest,
): boolean {
  const expectedMethod = response.method?.toUpperCase();
  return (
    (response.url === undefined || response.url === request.url) &&
    (expectedMethod === undefined || expectedMethod === request.method)
  );
}

export function mockJsonResponses(...responses: MockJsonResponse[]) {
  const requests: CapturedFetchRequest[] = [];
  const consumedIndexes = new Set<number>();

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = await captureRequest(input, init);
      requests.push(request);

      const responseIndex = responses.findIndex(
        (response, index) =>
          !consumedIndexes.has(index) && responseMatches(response, request),
      );
      const reusableGetResponse = responses.find(
        (response) =>
          request.method === 'GET' && responseMatches(response, request),
      );
      const response =
        responseIndex >= 0 ? responses[responseIndex] : reusableGetResponse;

      if (!response) {
        throw new Error(
          `No mocked JSON response queued for ${request.method} ${request.url}`,
        );
      }

      if (responseIndex >= 0) {
        consumedIndexes.add(responseIndex);
      }

      return Response.json(response.body, { status: 200, ...response.init });
    }),
  );

  return {
    requests,
    assertAllResponsesConsumed: () => {
      const pendingResponses = responses.length - consumedIndexes.size;
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

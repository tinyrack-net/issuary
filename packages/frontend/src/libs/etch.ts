/**
 * Convert HeadersInit to a plain object
 */
const headersToRecord = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return { ...headers };
};

export const etch = async (url: string, options?: RequestInit) => {
  const headers = headersToRecord(options?.headers);

  // Only set Content-Type: application/json when there's a body to send
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    throw res;
  }

  return res;
};

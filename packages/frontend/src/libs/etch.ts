export const etch = async (url: string, options?: RequestInit) => {
  const headers: HeadersInit = {
    ...(options?.headers || {}),
  };

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

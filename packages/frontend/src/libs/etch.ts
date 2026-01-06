export class EtchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EtchError';
  }
}

export const etch = async (
  url: string,
  options?: RequestInit,
) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    }
  });

  if (!res.ok) {
    throw new EtchError(`Etch request failed with status ${res.status}`);
  }

  return res;
}
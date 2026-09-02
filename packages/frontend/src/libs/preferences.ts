const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function readPreferenceCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const value = part.trim();
    if (value.startsWith(prefix)) {
      return decodeURIComponent(value.slice(prefix.length));
    }
  }
  return undefined;
}

export function writePreferenceCookie(name: string, value: string): void {
  // biome-ignore lint/suspicious/noDocumentCookie: synchronous cookie writes keep SSR preferences consistent on the next navigation.
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

export function removePreferenceCookie(name: string): void {
  // biome-ignore lint/suspicious/noDocumentCookie: synchronous removal is required before notifying same-tab subscribers.
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function migrateStoredPreference(
  name: string,
  isValid: (value: string) => boolean,
): string | undefined {
  const cookie = readPreferenceCookie(name);
  if (cookie !== undefined) return cookie;
  const stored = localStorage.getItem(name);
  if (stored === null || !isValid(stored)) return undefined;
  writePreferenceCookie(name, stored);
  localStorage.removeItem(name);
  return stored;
}

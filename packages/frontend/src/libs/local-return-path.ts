/** Accept only paths that remain local after browser URL normalization. */
export function localReturnPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return '/profile';
  try {
    return new URL(value, 'https://return.invalid').origin ===
      'https://return.invalid'
      ? value
      : '/profile';
  } catch {
    return '/profile';
  }
}

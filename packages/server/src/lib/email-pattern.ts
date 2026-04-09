/**
 * Check if an email address matches any of the allowed signup patterns.
 *
 * Supported patterns:
 * - `*` — Allow all emails
 * - `user@domain.com` — Exact email match (case-insensitive)
 * - `*@domain.com` — Allow any email at the specified domain
 *
 * An empty patterns array means signup is disabled entirely.
 *
 * @param email - The email address to check
 * @param patterns - Array of allowed email patterns
 * @returns `true` if the email matches at least one pattern
 */
export function isEmailAllowed(
  email: string,
  patterns: readonly string[],
): boolean {
  if (patterns.length === 0) {
    return false;
  }

  const normalizedEmail = email.toLowerCase();

  for (const pattern of patterns) {
    const normalizedPattern = pattern.toLowerCase().trim();

    // Wildcard: allow all
    if (normalizedPattern === '*') {
      return true;
    }

    // Domain wildcard: *@domain.com
    if (normalizedPattern.startsWith('*@')) {
      const domain = normalizedPattern.slice(2);
      if (normalizedEmail.endsWith(`@${domain}`)) {
        return true;
      }
      continue;
    }

    // Exact match
    if (normalizedEmail === normalizedPattern) {
      return true;
    }
  }

  return false;
}

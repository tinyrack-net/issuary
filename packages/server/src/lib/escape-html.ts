/**
 * Minimal HTML-escape for content placed inside attribute values and text nodes.
 * Does not cover every HTML context but is sufficient for form-post and
 * device-verification replies where only simple attribute values appear.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

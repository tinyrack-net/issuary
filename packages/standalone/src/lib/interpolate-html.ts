/**
 * Replace {{KEY}} placeholders in HTML with corresponding variable values.
 * Only matches keys that follow identifier naming rules
 * (start with a letter or underscore, followed by alphanumerics or underscores).
 * Unmatched placeholders are left as-is.
 */
export function interpolateHtml(
  html: string,
  variables: Record<string, string>,
): string {
  return html.replace(
    /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g,
    (match, key: string) => variables[key] ?? match,
  );
}

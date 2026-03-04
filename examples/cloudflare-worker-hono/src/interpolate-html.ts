export function interpolateHtml(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/{{([A-Z0-9_]+)}}/g, (_match, rawKey: string) => {
    return variables[rawKey] ?? '';
  });
}

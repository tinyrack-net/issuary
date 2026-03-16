/**
 * Build a `${ENV_VAR:-fallback}` template string for use in the defaults
 * object.  When `fallback` is omitted the pattern resolves to an empty string
 * (which will typically fail Zod validation, making the field required).
 */
export function envDefault(envVar: string, fallback?: string): string {
  if (fallback === undefined) {
    return `\${${envVar}}`;
  }
  return `\${${envVar}:-${fallback}}`;
}

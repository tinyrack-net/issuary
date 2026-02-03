/**
 * Interpolate environment variables in a string.
 *
 * Supported syntax:
 * - $VAR              → process.env.VAR or ''
 * - ${VAR}            → process.env.VAR or ''
 * - ${VAR:-default}   → process.env.VAR or 'default'
 * - ${VAR:-"default"} → process.env.VAR or 'default' (quotes stripped)
 * - ${VAR:-'default'} → process.env.VAR or 'default' (quotes stripped)
 *
 * Examples:
 *   interpolateEnv('$HOST')                    → 'localhost'
 *   interpolateEnv('${PORT:-8080}')            → '8080' (if PORT not set)
 *   interpolateEnv('https://${HOST}:${PORT}')  → 'https://localhost:3000'
 *
 * @param str - String containing environment variable references
 * @returns String with environment variables resolved
 */
export function interpolateEnv(str: string): string {
  // Pattern for ${VAR} and ${VAR:-default}
  // Captures: group 1 = var name, group 2 = default value part (including :-)
  const bracedPattern = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)(:-[^}]*)?\}/g;

  // Pattern for simple $VAR (must not be followed by {)
  const simplePattern = /\$([a-zA-Z_][a-zA-Z0-9_]*)(?!\{)/g;

  let result = str;

  // First pass: handle ${VAR} and ${VAR:-default}
  result = result.replace(
    bracedPattern,
    (_, name: string, defaultPart?: string) => {
      const envValue = process.env[name];
      if (envValue !== undefined) {
        return envValue;
      }

      // No env value, use default if provided
      if (defaultPart) {
        let defaultValue = defaultPart.slice(2); // Remove ":-" prefix

        // Handle quoted defaults
        defaultValue = defaultValue.trim();
        if (defaultValue.startsWith('"') && defaultValue.endsWith('"')) {
          defaultValue = defaultValue.slice(1, -1);
        } else if (defaultValue.startsWith("'") && defaultValue.endsWith("'")) {
          defaultValue = defaultValue.slice(1, -1);
        }

        return defaultValue;
      }

      return '';
    },
  );

  // Second pass: handle simple $VAR
  result = result.replace(simplePattern, (_, name: string) => {
    return process.env[name] ?? '';
  });

  return result;
}

/**
 * Maps an input type to its resolved type after env variable interpolation.
 * Strings remain strings, objects/arrays preserve their structure,
 * and all other primitives pass through unchanged.
 */
type ResolveEnvResult<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? ResolveEnvResult<U>[]
    : T extends Record<string, unknown>
      ? { [K in keyof T]: ResolveEnvResult<T[K]> }
      : T;

/**
 * Recursively resolve environment variables in all string values.
 *
 * @param value - Any value from parsed YAML
 * @returns Value with all string environment variables resolved,
 *          preserving the input's type structure
 */
export function resolveEnvVariables<T>(value: T): ResolveEnvResult<T> {
  if (typeof value === 'string') {
    return interpolateEnv(value) as ResolveEnvResult<T>;
  }
  if (Array.isArray(value)) {
    return value.map(resolveEnvVariables) as ResolveEnvResult<T>;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveEnvVariables(v)]),
    ) as ResolveEnvResult<T>;
  }
  return value as ResolveEnvResult<T>;
}

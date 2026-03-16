/**
 * Simple recursive deep-merge utility.
 *
 * - Plain objects are merged recursively.
 * - When the source object contains a `type` field (discriminated unions like
 *   `database`), the entire sub-object is replaced instead of merged so that
 *   leftover keys from the other variant don't leak through.
 * - Arrays, primitives, and null in `source` replace the corresponding
 *   `target` value.
 * - Only keys present in `source` override `target`.
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
): T {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = (target as Record<string, unknown>)[key];

    if (
      isPlainObject(sourceVal) &&
      isPlainObject(targetVal) &&
      !('type' in sourceVal)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        { ...targetVal },
        sourceVal,
      );
    } else {
      (result as Record<string, unknown>)[key] = sourceVal;
    }
  }

  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

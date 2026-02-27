import type z from 'zod';

/**
 * Read a property from a value treated as a generic record.
 */
function prop(obj: unknown, key: string): unknown {
  if (obj !== null && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Build a human-readable "Expected" hint from a Zod v4 issue, if one
 * can be derived beyond what the `message` field already says.
 */
function deriveExpected(issue: z.core.$ZodIssue): string | undefined {
  switch (issue.code) {
    case 'invalid_type': {
      const expected = prop(issue, 'expected');
      return typeof expected === 'string' ? expected : undefined;
    }

    case 'invalid_value': {
      const vals = prop(issue, 'values');
      if (Array.isArray(vals)) {
        return vals.map((v) => JSON.stringify(v)).join(' | ');
      }
      return undefined;
    }

    case 'too_small': {
      const minimum = prop(issue, 'minimum');
      if (typeof minimum !== 'number') return undefined;
      const inclusive = prop(issue, 'inclusive');
      const origin = prop(issue, 'origin');
      const op = inclusive === false ? '>' : '>=';
      return `${typeof origin === 'string' ? origin : 'value'} ${op} ${minimum}`;
    }

    case 'too_big': {
      const maximum = prop(issue, 'maximum');
      if (typeof maximum !== 'number') return undefined;
      const inclusive = prop(issue, 'inclusive');
      const origin = prop(issue, 'origin');
      const op = inclusive === false ? '<' : '<=';
      return `${typeof origin === 'string' ? origin : 'value'} ${op} ${maximum}`;
    }

    case 'invalid_format': {
      const fmt = prop(issue, 'format');
      return typeof fmt === 'string' ? `valid ${fmt}` : undefined;
    }

    default:
      return undefined;
  }
}

/**
 * Convert a Zod issue path to dot-notation with `[N]` for array indices.
 */
function formatPath(path: (string | number)[]): string {
  if (path.length === 0) return '(root)';

  let result = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      result += `[${segment}]`;
    } else {
      if (result.length > 0) result += '.';
      result += segment;
    }
  }
  return result;
}

/**
 * Format an array of Zod issues into a human-readable configuration
 * error message.
 */
export function formatConfigError(issues: z.core.$ZodIssue[]): string {
  const header = `Configuration validation failed (${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}):`;

  const entries = issues.map((issue, idx) => {
    const num = `  ${idx + 1}. `;
    const pathStr = formatPath(
      issue.path.map((s) => (typeof s === 'symbol' ? String(s) : s)),
    );
    const lines = [`${num}${pathStr}`, `     Error: ${issue.message}`];

    const expected = deriveExpected(issue);
    if (expected) {
      lines.push(`     Expected: ${expected}`);
    }

    return lines.join('\n');
  });

  return `${header}\n\n${entries.join('\n\n')}`;
}

/**
 * Error subclass that carries a pre-formatted configuration validation
 * message. Callers can print `error.message` directly to stderr.
 */
export class ConfigValidationError extends Error {
  override readonly name = 'ConfigValidationError';

  constructor(issues: z.core.$ZodIssue[]) {
    super(formatConfigError(issues));
  }
}

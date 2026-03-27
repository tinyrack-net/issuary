import type z from 'zod';

export function formatZodError(error: z.ZodError, label?: string): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String);
      const issueLabel = label ? [label, ...path].join('.') : path.join('.');

      return issueLabel ? `${issueLabel}: ${issue.message}` : issue.message;
    })
    .join('\n');
}

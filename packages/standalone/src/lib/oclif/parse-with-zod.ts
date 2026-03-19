import type z from 'zod';
import { formatZodError } from './format-zod-error.js';

export type ZodParserOptions<T> = {
  coerce?: (input: string) => Promise<unknown> | unknown;
  label?: string;
  schema: z.ZodType<T>;
};

export async function parseWithZod<T>(
  input: string,
  options: ZodParserOptions<T>,
): Promise<T> {
  const value = options.coerce ? await options.coerce(input) : input;
  const result = await options.schema.safeParseAsync(value);

  if (!result.success) {
    throw new Error(formatZodError(result.error, options.label));
  }

  return result.data;
}

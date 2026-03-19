import { Args } from '@oclif/core';
import type z from 'zod';
import { parseWithZod, type ZodParserOptions } from './parse-with-zod.js';

export type ZodArgOptions = {
  hidden?: boolean;
  ignoreStdin?: boolean;
  label?: string;
  name?: string;
  noCacheDefault?: boolean;
  coerce?: (input: string) => Promise<unknown> | unknown;
};

function createParserOptions(
  schema: z.ZodType<string | undefined>,
  options: ZodArgOptions,
): ZodParserOptions<string | undefined> {
  return {
    ...(options.coerce ? { coerce: options.coerce } : {}),
    ...((options.label ?? schema.description)
      ? { label: options.label ?? schema.description }
      : {}),
    schema,
  };
}

export function zodArg(
  schema: z.ZodType<string | undefined>,
  options: ZodArgOptions = {},
) {
  const parserOptions = createParserOptions(schema, options);
  const description = schema.description;
  const definition = Args.custom<string | undefined>({
    parse: async (input) => parseWithZod(input, parserOptions),
  });
  const baseOptions = {
    ...(description ? { description } : {}),
    ...(options.hidden ? { hidden: options.hidden } : {}),
    ...(options.ignoreStdin ? { ignoreStdin: options.ignoreStdin } : {}),
    ...(options.name ? { name: options.name } : {}),
    ...(options.noCacheDefault
      ? { noCacheDefault: options.noCacheDefault }
      : {}),
  };
  const missingValue = schema.safeParse(undefined);

  if (!missingValue.success) {
    return definition({
      ...baseOptions,
      required: true,
    });
  }

  if (missingValue.data !== undefined) {
    return definition({
      ...baseOptions,
      default: missingValue.data,
    });
  }

  return definition(baseOptions);
}

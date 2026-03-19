import { Flags } from '@oclif/core';
import type {
  AlphabetLowercase,
  AlphabetUppercase,
  Deprecation,
} from '@oclif/core/interfaces';
import type z from 'zod';
import { parseWithZod, type ZodParserOptions } from './parse-with-zod.js';

export type ZodFlagOptions = {
  aliases?: string[];
  allowStdin?: boolean | 'only';
  atLeastOne?: string[];
  char?: AlphabetLowercase | AlphabetUppercase;
  charAliases?: (AlphabetLowercase | AlphabetUppercase)[];
  coerce?: (input: string) => Promise<unknown> | unknown;
  combinable?: string[];
  deprecateAliases?: boolean;
  deprecated?: true | Deprecation;
  dependsOn?: string[];
  env?: string;
  exactlyOne?: string[];
  exclusive?: string[];
  helpGroup?: string;
  helpLabel?: string;
  helpValue?: string | string[];
  hidden?: boolean;
  label?: string;
  name?: string;
  noCacheDefault?: boolean;
  summary?: string;
};

function createParserOptions(
  schema: z.ZodType<string | undefined>,
  options: ZodFlagOptions,
): ZodParserOptions<string | undefined> {
  return {
    ...(options.coerce ? { coerce: options.coerce } : {}),
    ...((options.label ?? schema.description)
      ? { label: options.label ?? schema.description }
      : {}),
    schema,
  };
}

export function zodFlag(
  schema: z.ZodType<string | undefined>,
  options: ZodFlagOptions = {},
) {
  const parserOptions = createParserOptions(schema, options);
  const description = schema.description;
  const definition = Flags.custom<string | undefined>({
    parse: async (input) => parseWithZod(input, parserOptions),
  });
  const baseOptions = {
    ...(options.aliases ? { aliases: options.aliases } : {}),
    ...(options.allowStdin ? { allowStdin: options.allowStdin } : {}),
    ...(options.atLeastOne ? { atLeastOne: options.atLeastOne } : {}),
    ...(options.char ? { char: options.char } : {}),
    ...(options.charAliases ? { charAliases: options.charAliases } : {}),
    ...(options.combinable ? { combinable: options.combinable } : {}),
    ...(options.deprecateAliases
      ? { deprecateAliases: options.deprecateAliases }
      : {}),
    ...(options.deprecated ? { deprecated: options.deprecated } : {}),
    ...(options.dependsOn ? { dependsOn: options.dependsOn } : {}),
    ...(description ? { description } : {}),
    ...(options.env ? { env: options.env } : {}),
    ...(options.exactlyOne ? { exactlyOne: options.exactlyOne } : {}),
    ...(options.exclusive ? { exclusive: options.exclusive } : {}),
    ...(options.helpGroup ? { helpGroup: options.helpGroup } : {}),
    ...(options.helpLabel ? { helpLabel: options.helpLabel } : {}),
    ...(options.helpValue ? { helpValue: options.helpValue } : {}),
    ...(options.hidden ? { hidden: options.hidden } : {}),
    ...(options.name ? { name: options.name } : {}),
    ...(options.noCacheDefault
      ? { noCacheDefault: options.noCacheDefault }
      : {}),
    ...(options.summary ? { summary: options.summary } : {}),
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

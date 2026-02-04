/**
 * Generates a JSON Schema from the Zod-based AppConfigSchema.
 *
 * This script uses Zod v4's native `z.toJSONSchema()` to convert the
 * application configuration schema into a JSON Schema file that can be
 * used by YAML Language Server for editor-time validation, autocompletion,
 * and inline documentation when editing config.yaml.
 *
 * Usage:
 *   pnpm generate:config-schema
 *
 * The generated file is written to `config.schema.json` in the backend
 * package root directory, alongside `config.example.yaml`.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import z from 'zod/v4';
import { AppConfigSchema } from '../src/lib/config/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputPath = resolve(__dirname, '..', 'config.schema.json');

const jsonSchema = z.toJSONSchema(AppConfigSchema, {
  // Use 'input' mode to represent the pre-transform types.
  // This is correct for config.yaml validation because users provide
  // raw input values (e.g., port as string or number) that get
  // transformed at runtime by Zod.
  io: 'input',

  // Transform-based types (zz.PORT, zz.COERCE_BOOLEAN, zz.coerceInt)
  // are not directly representable in JSON Schema. Using 'any' converts
  // them to {} (unknown) instead of throwing. Combined with io: 'input',
  // these are actually resolved to their input union types (e.g.,
  // string | number for PORT) so this is mostly a safety net.
  unrepresentable: 'any',

  // Draft 7 has the widest compatibility with YAML Language Server
  // implementations across different editors.
  target: 'draft-07',
});

// Add a human-readable title and description to the root schema
const enrichedSchema = {
  ...jsonSchema,
  title: 'TinyAuth Configuration',
  description:
    'Configuration schema for TinyAuth OIDC Provider. ' +
    'See config.example.yaml for detailed documentation of each option.',
};

writeFileSync(outputPath, `${JSON.stringify(enrichedSchema, null, 2)}\n`);

console.log(`Generated config schema: ${outputPath}`);

import { writeFileSync } from 'node:fs';
import { buildCommand } from '@stricli/core';
import { createApp, createOpenApiDocumentation } from '@tinyauth/backend';
import { OPENAPI_CONFIG_DEFAULT } from '@tinyauth/backend/config';
import { generateSpecs } from 'hono-openapi';
import z from 'zod';
import { parseWithZod } from '../../../lib/cli/parse-with-zod.ts';
import type { StandaloneConfigInput } from '../../../lib/config/index.ts';
import { resolveConfig } from '../../../lib/load-config.ts';

/**
 * Export OpenAPI command
 *
 * Generates the OpenAPI spec as JSON.
 * Outputs to stdout by default, or to a file if output-path is provided.
 */
type ExportOpenapiArgs = [outputPath?: string];
type ExportOpenapiFlags = Record<string, never>;

const outputPathSchema = z.string().trim().min(1, 'must not be empty');

export async function runExportOpenapiCommand(
  _flags: ExportOpenapiFlags,
  outputPath?: string,
): Promise<void> {
  const config = {
    logging: {
      level: 'silent',
      format: 'json',
    },
    database: {
      type: 'sqlite',
      test: true,
    },
    security: {
      session_secret:
        '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
      hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
      pbkdf2_iterations: 1000,
    },
  } satisfies StandaloneConfigInput;

  const { app, cleanup, logger } = await createApp(await resolveConfig(config));

  try {
    const spec = await generateSpecs(app, {
      documentation: createOpenApiDocumentation(OPENAPI_CONFIG_DEFAULT),
    });

    const json = JSON.stringify(spec, null, 2);

    if (outputPath) {
      writeFileSync(outputPath, json, 'utf-8');
      logger.info({ outputPath }, 'OpenAPI spec written');
    } else {
      process.stdout.write(json);
    }
  } finally {
    await cleanup();
  }
}

export const exportOpenapiCommand = buildCommand<
  ExportOpenapiFlags,
  ExportOpenapiArgs
>({
  parameters: {
    flags: {},
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'Write spec to file instead of stdout',
          optional: true,
          parse: async (input) =>
            await parseWithZod(input, {
              label: 'output-path',
              schema: outputPathSchema,
            }),
        },
      ],
    },
  },
  docs: {
    brief: 'Export the OpenAPI spec as JSON',
    fullDescription: 'Export the OpenAPI spec as JSON',
  },
  func: runExportOpenapiCommand,
});

export default exportOpenapiCommand;

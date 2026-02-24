import { writeFileSync } from 'node:fs';
import { generateSpecs } from 'hono-openapi';
import { OPENAPI_DOCUMENTATION } from '#backend/lib/openapi.js';
import { createServer } from '#backend/server.js';
import { MINIMAL_TEST_CONFIG } from '#backend/test-utils/setup.js';

/**
 * Export the OpenAPI spec as JSON.
 *
 * Usage:
 *   tsx src/export-openapi.ts [output-path]
 *
 * If output-path is provided, writes to that file.
 * Otherwise, writes to stdout.
 */
async function main() {
  const outputPath = process.argv[2];

  const { app, cleanup, logger } = await createServer({
    config: MINIMAL_TEST_CONFIG,
    skipListen: true,
  });

  const spec = await generateSpecs(app, {
    documentation: OPENAPI_DOCUMENTATION,
  });

  const json = JSON.stringify(spec, null, 2);

  if (outputPath) {
    writeFileSync(outputPath, json, 'utf-8');
    logger.info({ outputPath }, 'OpenAPI spec written');
  } else {
    process.stdout.write(json);
  }

  await cleanup();
}

main().catch((err: unknown) => {
  console.error('Failed to export OpenAPI spec:', err);
  process.exit(1);
});

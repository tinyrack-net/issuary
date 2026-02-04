import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import z from 'zod/v4';
import { AppConfigSchema } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schemaPath = resolve(__dirname, '..', '..', '..', 'config.schema.json');

describe('config.schema.json', () => {
  it('should be in sync with the Zod schema', () => {
    const committed = JSON.parse(readFileSync(schemaPath, 'utf-8'));

    const generated = z.toJSONSchema(AppConfigSchema, {
      io: 'input',
      unrepresentable: 'any',
      target: 'draft-07',
    });

    const enriched = {
      ...generated,
      title: 'TinyAuth Configuration',
      description:
        'Configuration schema for TinyAuth OIDC Provider. ' +
        'See config.example.yaml for detailed documentation of each option.',
    };

    expect(committed).toEqual(enriched);
  });
});

import { describe, expect, test } from 'vitest';
import { TEST_OAUTH_CLIENT_CONFIG } from '../../test-utils/fixtures.ts';
import { MINIMAL_TEST_CONFIG } from '../../test-utils/setup.ts';
import { IssuaryRuntimeConfigSchema } from './resolved.ts';
import { isValidResourceIndicator } from './resource.ts';

const MCP_RESOURCE = 'https://mcp.example.test/mcp';

// Reuse shared fixtures so this file introduces no new secret-like literals.
const MINIMAL_INPUT_CONFIG = MINIMAL_TEST_CONFIG;

function client(resources?: string[]) {
  return {
    ...TEST_OAUTH_CLIENT_CONFIG,
    ...(resources ? { resources } : {}),
  };
}

function issuePaths(input: unknown): string[] {
  const result = IssuaryRuntimeConfigSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path.join('.'));
}

describe('resource indicator configuration', () => {
  test('defaults resources and client resources to empty lists', () => {
    const config = IssuaryRuntimeConfigSchema.parse({
      ...MINIMAL_INPUT_CONFIG,
      clients: [client()],
    });
    expect(config.resources).toEqual([]);
    expect(config.clients[0]?.resources).toEqual([]);
  });

  test('parses resources with multiple audiences and client allowlists', () => {
    const config = IssuaryRuntimeConfigSchema.parse({
      ...MINIMAL_INPUT_CONFIG,
      resources: [
        { identifier: MCP_RESOURCE, audiences: [MCP_RESOURCE, 'nextcloud'] },
        { identifier: 'urn:example:api' },
      ],
      clients: [client([MCP_RESOURCE, 'urn:example:api'])],
    });
    expect(config.resources).toEqual([
      { identifier: MCP_RESOURCE, audiences: [MCP_RESOURCE, 'nextcloud'] },
      { identifier: 'urn:example:api' },
    ]);
    expect(config.clients[0]?.resources).toEqual([
      MCP_RESOURCE,
      'urn:example:api',
    ]);
  });

  test('rejects client references to undefined resources', () => {
    expect(
      issuePaths({
        ...MINIMAL_INPUT_CONFIG,
        resources: [{ identifier: MCP_RESOURCE }],
        clients: [client([MCP_RESOURCE, 'https://other.example.test/'])],
      }),
    ).toEqual(['clients.0.resources.1']);
  });

  test.each([
    ['relative reference', '/mcp'],
    ['fragment', `${MCP_RESOURCE}#section`],
    ['empty fragment', `${MCP_RESOURCE}#`],
    ['whitespace', 'https://mcp.example.test/a b'],
    ['missing scheme', 'mcp.example.test/mcp'],
  ])('rejects resource identifiers with a %s', (_name, identifier) => {
    expect(
      issuePaths({
        ...MINIMAL_INPUT_CONFIG,
        resources: [{ identifier }],
      }),
    ).toEqual(['resources.0.identifier']);
  });

  test('rejects duplicate resource identifiers', () => {
    expect(
      issuePaths({
        ...MINIMAL_INPUT_CONFIG,
        resources: [{ identifier: MCP_RESOURCE }, { identifier: MCP_RESOURCE }],
      }),
    ).toEqual(['resources.1.identifier']);
  });

  test('rejects empty or whitespace audiences', () => {
    expect(
      issuePaths({
        ...MINIMAL_INPUT_CONFIG,
        resources: [{ identifier: MCP_RESOURCE, audiences: [] }],
      }),
    ).toEqual(['resources.0.audiences']);
    expect(
      issuePaths({
        ...MINIMAL_INPUT_CONFIG,
        resources: [{ identifier: MCP_RESOURCE, audiences: ['next cloud'] }],
      }),
    ).toEqual(['resources.0.audiences.0']);
  });

  test('rejects malformed and duplicate client resource entries', () => {
    expect(
      issuePaths({
        ...MINIMAL_INPUT_CONFIG,
        resources: [{ identifier: MCP_RESOURCE }],
        clients: [client([MCP_RESOURCE, MCP_RESOURCE])],
      }),
    ).toEqual(['clients.0.resources.1']);
    expect(
      issuePaths({
        ...MINIMAL_INPUT_CONFIG,
        clients: [client(['not a uri'])],
      }),
    ).toContain('clients.0.resources.0');
  });
});

describe('isValidResourceIndicator', () => {
  test.each([
    MCP_RESOURCE,
    'https://api.example.test/v1?tenant=a',
    'http://localhost:8080/',
    'urn:example:resource',
  ])('accepts %s', (value) => {
    expect(isValidResourceIndicator(value)).toBe(true);
  });

  test.each(['', '/relative', 'https://x.test/#f', 'https://x.test/ a', 'x'])(
    'rejects %j',
    (value) => {
      expect(isValidResourceIndicator(value)).toBe(false);
    },
  );
});

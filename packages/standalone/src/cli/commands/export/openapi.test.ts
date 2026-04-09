import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const exportState = vi.hoisted(() => ({
  cleanupMock: vi.fn(async () => {}),
  createAppMock: vi.fn(),
  createOpenApiDocumentationMock: vi.fn(),
  generateSpecsMock: vi.fn(),
  logger: {
    info: vi.fn(),
  },
  resolveConfigMock: vi.fn(),
}));

vi.mock('@tinyrack/tinyauth-server', () => ({
  createApp: exportState.createAppMock,
  createOpenApiDocumentation: exportState.createOpenApiDocumentationMock,
}));

vi.mock('@tinyrack/tinyauth-server/config', () => ({
  OPENAPI_CONFIG_DEFAULT: {
    enabled: true,
    title: 'TinyAuth API',
    description: 'OpenID Connect Provider API',
    ui_title: 'TinyAuth API Reference',
  },
}));

vi.mock('hono-openapi', () => ({
  generateSpecs: exportState.generateSpecsMock,
}));

vi.mock('../../../lib/load-config.ts', () => ({
  resolveConfig: exportState.resolveConfigMock,
}));

describe('ExportOpenapiCommand', () => {
  beforeEach(() => {
    exportState.cleanupMock.mockReset();
    exportState.createAppMock.mockReset();
    exportState.createOpenApiDocumentationMock.mockReset();
    exportState.generateSpecsMock.mockReset();
    exportState.logger.info.mockReset();
    exportState.resolveConfigMock.mockReset();

    exportState.resolveConfigMock.mockResolvedValue({
      logging: { format: 'json', level: 'silent' },
    });
    exportState.createAppMock.mockResolvedValue({
      app: { openapi: true },
      cleanup: exportState.cleanupMock,
      logger: exportState.logger,
    });
    exportState.createOpenApiDocumentationMock.mockReturnValue({
      info: {
        title: 'TinyAuth API',
      },
    });
    exportState.generateSpecsMock.mockResolvedValue({
      openapi: '3.1.0',
      info: { title: 'TinyAuth API' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('writes the generated spec to stdout by default', async () => {
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    vi.resetModules();
    const { runExportOpenapiCommand } = await import('./openapi.ts');

    await runExportOpenapiCommand({});

    expect(exportState.resolveConfigMock).toHaveBeenCalled();
    expect(exportState.createAppMock).toHaveBeenCalled();
    expect(exportState.createOpenApiDocumentationMock).toHaveBeenCalledWith({
      enabled: true,
      title: 'TinyAuth API',
      description: 'OpenID Connect Provider API',
      ui_title: 'TinyAuth API Reference',
    });
    expect(exportState.generateSpecsMock).toHaveBeenCalledWith(
      { openapi: true },
      expect.objectContaining({
        documentation: expect.objectContaining({
          info: expect.objectContaining({
            title: 'TinyAuth API',
          }),
        }),
      }),
    );
    expect(writeSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          openapi: '3.1.0',
          info: { title: 'TinyAuth API' },
        },
        null,
        2,
      ),
    );
    expect(exportState.cleanupMock).toHaveBeenCalledTimes(1);
  });

  test('writes the generated spec to a file when output path is provided', async () => {
    const tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-openapi-'),
    );
    const outputPath = path.join(tempDir, 'openapi.json');

    vi.resetModules();
    const { runExportOpenapiCommand } = await import('./openapi.ts');

    await runExportOpenapiCommand({}, outputPath);

    const written = await fs.promises.readFile(outputPath, 'utf-8');
    expect(JSON.parse(written)).toEqual({
      openapi: '3.1.0',
      info: { title: 'TinyAuth API' },
    });
    expect(exportState.logger.info).toHaveBeenCalledWith(
      { outputPath },
      'OpenAPI spec written',
    );
    expect(exportState.cleanupMock).toHaveBeenCalledTimes(1);

    await fs.promises.rm(tempDir, { force: true, recursive: true });
  });
});

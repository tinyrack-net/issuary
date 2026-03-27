import type { StricliProcess } from '@stricli/core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const appState = vi.hoisted(() => ({
  cleanupMock: vi.fn(async () => {}),
  createAppMock: vi.fn(),
  createLoggerMock: vi.fn(),
  createOpenApiDocumentationMock: vi.fn(),
  generateSpecsMock: vi.fn(),
  initializeServicesMock: vi.fn(),
  loadConfigMock: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  resolveConfigMock: vi.fn(),
  runAllMock: vi.fn(),
}));

vi.mock('@tinyauth/backend/services', () => ({
  initializeServices: appState.initializeServicesMock,
}));

vi.mock('../lib/load-config.ts', () => ({
  loadConfig: appState.loadConfigMock,
  resolveConfig: appState.resolveConfigMock,
}));

vi.mock('../lib/logger.ts', () => ({
  createLogger: appState.createLoggerMock,
}));

vi.mock('@tinyauth/backend', () => ({
  createApp: appState.createAppMock,
  createOpenApiDocumentation: appState.createOpenApiDocumentationMock,
}));

vi.mock('@tinyauth/backend/config', () => ({
  OPENAPI_CONFIG_DEFAULT: {
    enabled: true,
    title: 'TinyAuth API',
    description: 'OpenID Connect Provider API',
    ui_title: 'TinyAuth API Reference',
  },
}));

vi.mock('hono-openapi', () => ({
  generateSpecs: appState.generateSpecsMock,
}));

function createMockProcess(): StricliProcess {
  return {
    env: {},
    exitCode: null,
    stderr: {
      write: vi.fn(),
    },
    stdout: {
      write: vi.fn(),
    },
  };
}

describe('standalone Stricli app', () => {
  beforeEach(() => {
    appState.cleanupMock.mockReset();
    appState.createAppMock.mockReset();
    appState.createLoggerMock.mockReset();
    appState.createOpenApiDocumentationMock.mockReset();
    appState.generateSpecsMock.mockReset();
    appState.initializeServicesMock.mockReset();
    appState.loadConfigMock.mockReset();
    appState.logger.debug.mockReset();
    appState.logger.error.mockReset();
    appState.logger.info.mockReset();
    appState.logger.warn.mockReset();
    appState.resolveConfigMock.mockReset();
    appState.runAllMock.mockReset();

    appState.createLoggerMock.mockReturnValue(appState.logger);
    appState.loadConfigMock.mockReturnValue({
      logging: { format: 'json', level: 'silent' },
    });
    appState.resolveConfigMock.mockResolvedValue({
      logging: { format: 'json', level: 'silent' },
    });
    appState.initializeServicesMock.mockResolvedValue({
      cleanup: appState.cleanupMock,
      services: {
        cleanupService: {
          runAll: appState.runAllMock,
        },
      },
    });
    appState.createAppMock.mockResolvedValue({
      app: { openapi: true },
      cleanup: appState.cleanupMock,
      logger: appState.logger,
    });
    appState.createOpenApiDocumentationMock.mockReturnValue({
      info: {
        title: 'TinyAuth API',
      },
    });
    appState.generateSpecsMock.mockResolvedValue({
      openapi: '3.1.0',
      info: { title: 'TinyAuth API' },
    });
  });

  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  test('routes cleanup flags through the app', async () => {
    appState.runAllMock.mockResolvedValue({
      tasks: [],
      totalDeleted: 0,
      totalDurationMs: 2,
      totalFailed: 0,
      totalSkipped: 0,
    });

    vi.resetModules();
    const { runCli } = await import('./app.ts');
    const mockProcess = createMockProcess();

    await runCli(['cleanup', '-c', '/tmp/tinyauth.yaml', '--verbose'], {
      process: mockProcess,
    });

    expect(appState.loadConfigMock).toHaveBeenCalledWith('/tmp/tinyauth.yaml');
    expect(appState.runAllMock).toHaveBeenCalledWith({
      dryRun: false,
      verbose: true,
    });
  });

  test('routes nested export openapi command', async () => {
    vi.resetModules();
    const { runCli } = await import('./app.ts');
    const mockProcess = createMockProcess();
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    await runCli(['export', 'openapi'], {
      process: mockProcess,
    });

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
  });

  test('prints version at the root route', async () => {
    vi.resetModules();
    const { runCli } = await import('./app.ts');
    const mockProcess = createMockProcess();

    await runCli(['--version'], {
      process: mockProcess,
    });

    expect(mockProcess.stdout.write).toHaveBeenCalledWith('1.0.0\n');
  });
});

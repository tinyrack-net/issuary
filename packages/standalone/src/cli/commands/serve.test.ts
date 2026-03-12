import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const serveMocks = vi.hoisted(() => ({
  serve: vi.fn(),
  createStandaloneApp: vi.fn(),
  loadConfig: vi.fn(),
}));

vi.mock('@hono/node-server', () => ({
  serve: serveMocks.serve,
}));

vi.mock('#standalone/app.js', () => ({
  createStandaloneApp: serveMocks.createStandaloneApp,
}));

vi.mock('#standalone/lib/load-config.js', () => ({
  loadConfig: serveMocks.loadConfig,
}));

function mockProcessExit() {
  return vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit:${String(code ?? 0)}`);
  });
}

describe('serveCommand', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    serveMocks.loadConfig.mockReturnValue({ config: 'loaded' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('starts the server and performs graceful shutdown on SIGINT', async () => {
    const cleanup = vi.fn(async () => {});
    const close = vi.fn();
    const logger = {
      info: vi.fn(),
    };
    const signalHandlers = new Map<string, () => Promise<void>>();

    serveMocks.createStandaloneApp.mockResolvedValue({
      app: {
        fetch: vi.fn(),
      },
      cleanup,
      services: {
        config: {
          server: {
            listen_port: 4010,
          },
        },
      },
      logger,
    });
    serveMocks.serve.mockImplementation((options, callback) => {
      callback({
        port: 4010,
        address: '0.0.0.0',
        family: 'IPv4',
      });
      return {
        close,
        options,
      };
    });

    vi.spyOn(process, 'on').mockImplementation((event, listener) => {
      signalHandlers.set(String(event), async () => {
        await listener();
      });
      return process;
    });

    const exitSpy = mockProcessExit();
    const { serveCommand } = await import('./serve.js');

    await serveCommand.parseAsync(['--config-path', '/tmp/config.yaml'], {
      from: 'user',
    });

    expect(serveMocks.serve).toHaveBeenCalledWith(
      {
        fetch: expect.any(Function),
        port: 4010,
        hostname: '0.0.0.0',
      },
      expect.any(Function),
    );
    expect(logger.info).toHaveBeenCalledWith(
      { port: 4010 },
      'Server listening on port 4010',
    );

    const sigintHandler = signalHandlers.get('SIGINT');
    if (!sigintHandler) {
      throw new Error('Expected SIGINT handler to be registered');
    }

    await expect(sigintHandler()).rejects.toThrow('process.exit:0');

    expect(close).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test('logs startup failures and exits with code 1', async () => {
    serveMocks.createStandaloneApp.mockRejectedValue(
      new Error('startup failed'),
    );

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const exitSpy = mockProcessExit();
    const { serveCommand } = await import('./serve.js');

    await expect(
      serveCommand.parseAsync(['--config-path', '/tmp/config.yaml'], {
        from: 'user',
      }),
    ).rejects.toThrow('process.exit:1');

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

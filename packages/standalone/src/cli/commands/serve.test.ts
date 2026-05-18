import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const serveMocks = vi.hoisted(() => ({
  serve: vi.fn(),
  createAdminApp: vi.fn(),
  createStandaloneApp: vi.fn(),
  loadConfig: vi.fn(),
}));

vi.mock('@hono/node-server', () => ({
  serve: serveMocks.serve,
}));

vi.mock('@tinyrack/tinyauth-server', () => ({
  createAdminApp: serveMocks.createAdminApp,
}));

vi.mock('../../app.ts', () => ({
  createStandaloneApp: serveMocks.createStandaloneApp,
}));

vi.mock('../../lib/load-config.ts', () => ({
  loadConfig: serveMocks.loadConfig,
}));

function mockProcessExit() {
  return vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit:${String(code ?? 0)}`);
  });
}

function createAppResult(config: {
  server: { listen_port: number };
  admin: {
    enabled: boolean;
    mode: 'same-port' | 'separate-port';
    bind_host: string;
    listen_port?: number;
  };
}) {
  return {
    app: {
      fetch: vi.fn(),
    },
    cleanup: vi.fn(async () => {}),
    services: {
      config,
      scheduler: {
        start: vi.fn(),
      },
    },
    logger: {
      info: vi.fn(),
    },
  };
}

describe('ServeCommand', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    serveMocks.loadConfig.mockReturnValue({ config: 'loaded' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('starts one server when admin is disabled', async () => {
    const appResult = createAppResult({
      server: {
        listen_port: 4010,
      },
      admin: {
        enabled: false,
        mode: 'same-port',
        bind_host: '127.0.0.1',
      },
    });

    serveMocks.createStandaloneApp.mockResolvedValue(appResult);
    serveMocks.serve.mockReturnValue({
      close: vi.fn(),
    });

    const { runServeCommand } = await import('./serve.ts');

    await runServeCommand({
      configPath: '/tmp/config.yaml',
    });

    expect(serveMocks.serve).toHaveBeenCalledTimes(1);
    expect(serveMocks.serve).toHaveBeenCalledWith(
      {
        fetch: appResult.app.fetch,
        port: 4010,
        hostname: '0.0.0.0',
      },
      expect.any(Function),
    );
    expect(serveMocks.createAdminApp).not.toHaveBeenCalled();
  });

  test('starts one server when admin uses same-port mode', async () => {
    const appResult = createAppResult({
      server: {
        listen_port: 4010,
      },
      admin: {
        enabled: true,
        mode: 'same-port',
        bind_host: '127.0.0.1',
      },
    });

    serveMocks.createStandaloneApp.mockResolvedValue(appResult);
    serveMocks.serve.mockReturnValue({
      close: vi.fn(),
    });

    const { runServeCommand } = await import('./serve.ts');

    await runServeCommand({
      configPath: '/tmp/config.yaml',
    });

    expect(serveMocks.serve).toHaveBeenCalledTimes(1);
    expect(serveMocks.createAdminApp).not.toHaveBeenCalled();
  });

  test('starts a separate admin server with configured host and port using shared services', async () => {
    const appResult = createAppResult({
      server: {
        listen_port: 4010,
      },
      admin: {
        enabled: true,
        mode: 'separate-port',
        bind_host: '127.0.0.1',
        listen_port: 4011,
      },
    });
    const adminApp = {
      fetch: vi.fn(),
    };

    serveMocks.createStandaloneApp.mockResolvedValue(appResult);
    serveMocks.createAdminApp.mockReturnValue(adminApp);
    serveMocks.serve.mockReturnValue({
      close: vi.fn(),
    });

    const { runServeCommand } = await import('./serve.ts');

    await runServeCommand({
      configPath: '/tmp/config.yaml',
    });

    expect(serveMocks.createAdminApp).toHaveBeenCalledWith({
      config: appResult.services.config,
      services: appResult.services,
    });
    expect(appResult.services.scheduler.start).not.toHaveBeenCalled();
    expect(serveMocks.serve).toHaveBeenCalledTimes(2);
    expect(serveMocks.serve).toHaveBeenNthCalledWith(
      1,
      {
        fetch: appResult.app.fetch,
        port: 4010,
        hostname: '0.0.0.0',
      },
      expect.any(Function),
    );
    expect(serveMocks.serve).toHaveBeenNthCalledWith(
      2,
      {
        fetch: adminApp.fetch,
        port: 4011,
        hostname: '127.0.0.1',
      },
      expect.any(Function),
    );
  });

  test('closes both servers and calls cleanup once on separate-port shutdown', async () => {
    const appResult = createAppResult({
      server: {
        listen_port: 4010,
      },
      admin: {
        enabled: true,
        mode: 'separate-port',
        bind_host: '127.0.0.1',
        listen_port: 4011,
      },
    });
    const mainClose = vi.fn();
    const adminClose = vi.fn();
    const signalHandlers = new Map<string, () => Promise<void>>();

    serveMocks.createStandaloneApp.mockResolvedValue(appResult);
    serveMocks.createAdminApp.mockReturnValue({
      fetch: vi.fn(),
    });
    serveMocks.serve.mockImplementation((options, callback) => {
      callback({
        port: options.port,
        address: options.hostname,
        family: 'IPv4',
      });

      return {
        close:
          serveMocks.serve.mock.calls.length === 1 ? mainClose : adminClose,
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
    const { runServeCommand } = await import('./serve.ts');

    await runServeCommand({
      configPath: '/tmp/config.yaml',
    });

    expect(appResult.logger.info).toHaveBeenCalledWith(
      { port: 4010 },
      'Server listening on port 4010',
    );
    expect(appResult.logger.info).toHaveBeenCalledWith(
      { host: '127.0.0.1', port: 4011 },
      'Admin server listening on 127.0.0.1:4011',
    );

    const sigintHandler = signalHandlers.get('SIGINT');
    if (!sigintHandler) {
      throw new Error('Expected SIGINT handler to be registered');
    }

    await expect(sigintHandler()).rejects.toThrow('process.exit:0');

    expect(mainClose).toHaveBeenCalledTimes(1);
    expect(adminClose).toHaveBeenCalledTimes(1);
    expect(appResult.cleanup).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test('logs startup failures and exits with code 1', async () => {
    serveMocks.createStandaloneApp.mockRejectedValue(
      new Error('startup failed'),
    );

    const { runServeCommand } = await import('./serve.ts');

    await expect(
      runServeCommand({
        configPath: '/tmp/config.yaml',
      }),
    ).rejects.toThrow('startup failed');
  });
});

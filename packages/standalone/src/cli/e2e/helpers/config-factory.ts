import * as fs from 'node:fs/promises';
import { type AddressInfo, createServer } from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';

/**
 * Finds a free port by briefly binding to port 0.
 */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

interface CreateTestConfigFileResult {
  configPath: string;
  port: number;
  cleanup: () => Promise<void>;
}

/**
 * Creates a temporary YAML config file with a dynamically allocated port.
 */
export async function createTestConfigFile(
  overrides?: Record<string, unknown>,
): Promise<CreateTestConfigFileResult> {
  const port = await getFreePort();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tinyauth-e2e-'));

  const config: Record<string, unknown> = {
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
    logging: {
      level: 'error',
      format: 'json',
    },
    email: {
      transport: 'test',
    },
    frontend: {
      enabled: false,
    },
    server: {
      public_origin: `http://localhost:${port}`,
      listen_port: port,
    },
    scheduler: {
      enabled: false,
    },
    ...overrides,
  };

  const configPath = path.join(tmpDir, 'config.yaml');
  await fs.writeFile(configPath, YAML.stringify(config), 'utf-8');

  return {
    configPath,
    port,
    cleanup: async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

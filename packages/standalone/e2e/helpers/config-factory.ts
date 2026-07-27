import * as fs from 'node:fs/promises';
import { type AddressInfo, createServer } from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';

const RETRIABLE_REMOVE_ERROR_CODES = new Set(['EBUSY', 'ENOTEMPTY', 'EPERM']);
const PORT_RESERVATION_MAX_AGE_MS = 15 * 60 * 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }

  const code = Reflect.get(error, 'code');
  return typeof code === 'string' ? code : undefined;
}

function getListeningPort(address: AddressInfo | string | null): number {
  if (typeof address === 'object' && address !== null) {
    return address.port;
  }

  throw new Error('Expected test server to listen on a TCP port');
}

/**
 * Finds a free port by briefly binding to port 0.
 */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '0.0.0.0', () => {
      const port = getListeningPort(srv.address());
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function removeStalePortReservation(lockPath: string): Promise<void> {
  try {
    const stats = await fs.stat(lockPath);
    if (Date.now() - stats.mtimeMs > PORT_RESERVATION_MAX_AGE_MS) {
      await fs.rm(lockPath, { force: true });
    }
  } catch (error) {
    if (getErrorCode(error) !== 'ENOENT') {
      throw error;
    }
  }
}

export async function reserveFreePort(): Promise<{
  port: number;
  release: () => Promise<void>;
}> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const port = await getFreePort();
    const lockPath = path.join(os.tmpdir(), `tinyauth-e2e-port-${port}.lock`);

    try {
      await fs.writeFile(lockPath, String(process.pid), {
        encoding: 'utf-8',
        flag: 'wx',
      });
      return {
        port,
        release: async () => {
          await fs.rm(lockPath, { force: true });
        },
      };
    } catch (error) {
      if (getErrorCode(error) !== 'EEXIST') {
        throw error;
      }
      await removeStalePortReservation(lockPath);
    }
  }

  throw new Error('Unable to reserve a unique test server port');
}

export async function removeDirectoryWithRetry(dir: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = getErrorCode(error);
      if (!code || !RETRIABLE_REMOVE_ERROR_CODES.has(code) || attempt === 4) {
        throw error;
      }
      await delay(100 * (attempt + 1));
    }
  }
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
  const { port, release } = await reserveFreePort();
  let tmpDir: string;
  try {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tinyauth-e2e-'));
  } catch (error) {
    await release();
    throw error;
  }

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
      try {
        await removeDirectoryWithRetry(tmpDir);
      } finally {
        await release();
      }
    },
  };
}

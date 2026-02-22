import { E2E_DEFAULT_CONFIG, E2E_DEFAULT_PORTS } from '@frontend-e2e/configs/default.js';
import {
  E2E_TOTP_REQUIRED_CONFIG,
  E2E_TOTP_REQUIRED_PORTS,
} from '@frontend-e2e/configs/totp-required.js';
import { createE2EServer } from './create-server.js';

/**
 * Playwright globalSetup.
 *
 * Starts all e2e server pairs (backend + Vite) for each config group.
 * Each config group runs on its own pair of ports so tests
 * can target different backend configurations in parallel.
 *
 * Returns a teardown function that stops all servers.
 */
export default async function globalSetup() {
  const teardowns = await Promise.all([
    createE2EServer(E2E_DEFAULT_CONFIG, E2E_DEFAULT_PORTS),
    createE2EServer(E2E_TOTP_REQUIRED_CONFIG, E2E_TOTP_REQUIRED_PORTS),
  ]);

  return async () => {
    await Promise.all(teardowns.map((teardown) => teardown()));
  };
}

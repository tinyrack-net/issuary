import {
  E2E_EMAIL_VERIFICATION_CONFIG,
  E2E_EMAIL_VERIFICATION_PORTS,
} from '@frontend-e2e/configs/email-verification.js';
import {
  E2E_MINIMAL_CONFIG,
  E2E_MINIMAL_PORTS,
} from '@frontend-e2e/configs/minimal.js';
import {
  E2E_REGISTRATION_DISABLED_CONFIG,
  E2E_REGISTRATION_DISABLED_PORTS,
} from '@frontend-e2e/configs/registration-disabled.js';
import {
  E2E_TERMS_CONFIG,
  E2E_TERMS_PORTS,
} from '@frontend-e2e/configs/terms.js';
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
  const servers = await Promise.all([
    createE2EServer(E2E_MINIMAL_CONFIG, E2E_MINIMAL_PORTS),
    createE2EServer(E2E_TOTP_REQUIRED_CONFIG, E2E_TOTP_REQUIRED_PORTS),
    createE2EServer(
      E2E_EMAIL_VERIFICATION_CONFIG,
      E2E_EMAIL_VERIFICATION_PORTS,
    ),
    createE2EServer(
      E2E_REGISTRATION_DISABLED_CONFIG,
      E2E_REGISTRATION_DISABLED_PORTS,
    ),
    createE2EServer(E2E_TERMS_CONFIG, E2E_TERMS_PORTS),
  ]);

  return async () => {
    await Promise.all(servers.map((server) => server.teardown()));
  };
}

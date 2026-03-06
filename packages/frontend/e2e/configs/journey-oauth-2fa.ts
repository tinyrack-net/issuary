import { createEmailVerification2faRequiredConfig } from '#frontend-e2e/configs/email-verification-2fa-required.js';
import type { E2EConfigResult } from '#frontend-e2e/setup/create-server.js';

/**
 * Creates a config focused on OAuth continuation through email
 * verification and required 2FA journeys.
 */
export function createJourneyOauth2faConfig(
  backendPort: number,
  frontendPort: number,
): E2EConfigResult {
  return createEmailVerification2faRequiredConfig(backendPort, frontendPort);
}

import { createEmailVerification2faRequiredConfig } from '@frontend-e2e/configs/email-verification-2fa-required.js';
import type { AppConfigInput } from '@tinyauth/backend/app';

/**
 * Creates a config focused on OAuth continuation through email
 * verification and required 2FA journeys.
 */
export function createJourneyOauth2faConfig(
  backendPort: number,
  frontendPort: number,
): AppConfigInput {
  return createEmailVerification2faRequiredConfig(backendPort, frontendPort);
}

import { AppConfigs } from '@/lib/config.js';
import { e } from '@/schemas/error.js';

/**
 * Validates that a provider exists in the configuration
 *
 * @param clientId - The OAuth client ID to validate
 * @returns The provider configuration if found
 * @throws {OAuthClientNotFound} If the provider is not found
 */
export const validateProvider = async (clientId: string) => {
  const provider = AppConfigs.providers.find((provider) => {
    return provider.client_id === clientId;
  });
  if (!provider) {
    throw new e.OAuthClientNotFound.Error();
  }
  return provider;
};

import { AppConfigs } from '@/lib/config.js';

export class ProviderNotFoundError extends Error {
  constructor(providerId: string) {
    super(`Provider with ID ${providerId} not found`);
  }
}

export const validateProvider = async (clientId: string) => {
  const provider = AppConfigs.providers.find((provider) => {
    return provider.client_id === clientId;
  });
  if (!provider) {
    throw new ProviderNotFoundError(clientId);
  }
  return provider;
};

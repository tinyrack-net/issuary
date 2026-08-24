import {
  type ClientConfig,
  ClientConfigSchema,
  ClientConfigsSchema,
} from '@tinyrack/issuary-server/config';

export const StandaloneClientConfigSchema = ClientConfigSchema;

export const StandaloneClientConfigsSchema = ClientConfigsSchema;

export type StandaloneClientConfig = ClientConfig;

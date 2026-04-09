import {
  type ClientConfig,
  ClientConfigSchema,
  ClientConfigsSchema,
} from '@tinyrack/tinyauth-server/config';

export const StandaloneClientConfigSchema = ClientConfigSchema;

export const StandaloneClientConfigsSchema = ClientConfigsSchema;

export type StandaloneClientConfig = ClientConfig;

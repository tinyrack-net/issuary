import {
  type ClientConfig,
  ClientConfigSchema,
  ClientConfigsSchema,
} from '@tinyauth/backend/config';

export const StandaloneClientConfigSchema = ClientConfigSchema;

export const StandaloneClientConfigsSchema = ClientConfigsSchema;

export type StandaloneClientConfig = ClientConfig;

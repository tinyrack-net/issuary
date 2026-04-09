import {
  type UserConfig,
  UserConfigSchema,
  UserConfigsSchema,
} from '@tinyrack/tinyauth-server/config';

export const StandaloneUserConfigSchema = UserConfigSchema;

export const StandaloneUserConfigsSchema = UserConfigsSchema;

export type StandaloneUserConfig = UserConfig;

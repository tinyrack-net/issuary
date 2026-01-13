import { queryOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';
import { queryKeys } from './keys';

export type Theme =
  | 'light'
  | 'dark'
  | 'cupcake'
  | 'bumblebee'
  | 'emerald'
  | 'corporate'
  | 'synthwave'
  | 'retro'
  | 'cyberpunk'
  | 'valentine'
  | 'halloween'
  | 'garden'
  | 'forest'
  | 'aqua'
  | 'lofi'
  | 'pastel'
  | 'fantasy'
  | 'wireframe'
  | 'black'
  | 'luxury'
  | 'dracula'
  | 'cmyk'
  | 'autumn'
  | 'business'
  | 'acid'
  | 'lemonade'
  | 'night'
  | 'coffee'
  | 'winter'
  | 'dim'
  | 'nord'
  | 'sunset'
  | 'caramellatte'
  | 'abyss'
  | 'silk';

export type ThemeMode = 'light' | 'dark' | 'system';

export type AppConfigs = {
  app: {
    supported_languages: string[];
    default_language: string;
    fallback_language: string;
    light_theme: Theme;
    dark_theme: Theme;
    theme_mode: ThemeMode;
    background_url?: string;
    public_registration: boolean;
  };
  database: {
    enabled: boolean;
  };
  authentication_methods: Record<
    string,
    {
      enabled: boolean;
      type: string;
      // Password auth method specific fields
      passkey?: {
        enabled: boolean;
        required: boolean;
      };
      totp?: {
        enabled: boolean;
        required: boolean;
      };
    }
  >;
};

export const appConfigQueryOptions = queryOptions({
  queryKey: queryKeys.config(),
  queryFn: async () => {
    const response = await etch('/api/v1/config');
    const data = await response.json();
    return data as AppConfigs;
  },
});

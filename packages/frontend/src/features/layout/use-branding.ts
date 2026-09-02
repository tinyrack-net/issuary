import { useSuspenseQuery } from '@tanstack/react-query';
import defaultIconUrl from '@tinyrack/ui/brand/apps/issuary-app-icon.svg';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';

type Branding = {
  /**
   * The deployment's product name, or `undefined` when it has not configured
   * one. Deliberately not defaulted to any screen's copy: this is the page's
   * `h1` on every auth screen, so it is kept separate from screen-specific
   * task copy.
   */
  title: string | undefined;
  subtitle: string | undefined;
  loginMethodDescription: string | undefined;
  iconUrl: string;
  logoUrl: string | undefined;
};

/**
 * Resolves the deployment's branding for the active language.
 *
 * Every localized branding field falls back to the configured fallback
 * language before falling back to nothing, so a deployment that only
 * translated some languages still renders something sensible.
 *
 * The `?lang=` search param wins over the stored/detected language, matching
 * how the auth screens resolve their own localized config. Read loosely
 * because this runs from the layout, which is not tied to one route.
 */
export function useBranding(): Branding {
  const { i18n } = useTranslation();
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);
  const [search] = useSearchParams();
  const language = search.get('lang') ?? i18n.language;
  const fallback = config.i18n.fallback_language;

  const localized = (field: Record<string, string> | null | undefined) =>
    field?.[language] ?? field?.[fallback];

  return {
    title: localized(config.branding.title),
    subtitle: localized(config.branding.subtitle),
    loginMethodDescription: localized(config.branding.login_method_description),
    iconUrl: config.branding.icon_url ?? defaultIconUrl,
    logoUrl: config.branding.logo_url ?? undefined,
  };
}

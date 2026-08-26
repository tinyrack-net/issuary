import { useSuspenseQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';

type Branding = {
  /**
   * The deployment's product name, or `undefined` when it has not configured
   * one. Deliberately not defaulted to any screen's copy: this is the page's
   * `h1` on every auth screen, so borrowing e.g. the sign-in title would put
   * "Welcome back!" at the top of the register and consent screens.
   */
  title: string | undefined;
  iconUrl: string | undefined;
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
  const search = useSearch({ strict: false });

  const langParam = 'lang' in search ? search.lang : undefined;
  const language = typeof langParam === 'string' ? langParam : i18n.language;
  const fallback = config.i18n.fallback_language;

  const localized = (field: Record<string, string> | null | undefined) =>
    field?.[language] ?? field?.[fallback];

  return {
    title: localized(config.branding.title),
    iconUrl: config.branding.icon_url ?? undefined,
  };
}

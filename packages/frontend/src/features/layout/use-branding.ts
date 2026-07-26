import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';

type Branding = {
  /** Product name. Falls back to the generic sign-in title. */
  title: string;
  /** Supporting line under the title, if the deployment configured one. */
  subtitle: string | undefined;
  iconUrl: string | undefined;
  backgroundUrl: string | undefined;
};

/**
 * Resolves the deployment's branding for the active language.
 *
 * Every localized branding field falls back to the configured fallback
 * language before falling back to the app's own copy, so a deployment that
 * only translated some languages still renders something sensible.
 *
 * @param lang Overrides the active i18n language, for the `?lang=` search param.
 */
export function useBranding(lang?: string): Branding {
  const { t, i18n } = useTranslation();
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);

  const language = lang ?? i18n.language;
  const fallback = config.i18n.fallback_language;

  const localized = (field: Record<string, string> | null | undefined) =>
    field?.[language] ?? field?.[fallback];

  return {
    title: localized(config.branding.title) ?? t('login.title'),
    subtitle: localized(config.branding.subtitle),
    iconUrl: config.branding.icon_url ?? undefined,
    backgroundUrl: config.branding.background_url ?? undefined,
  };
}

import { GlobeSimpleIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  type AuthorizationContextSearch,
  hasAuthorizationContext,
  type OAuthSearch,
} from '#frontend/libs/oauth-search.ts';
import { getAuthorizationContextQueryOptions } from '#frontend/queries/authorization-context.ts';

type AuthorizationContextBannerProps = {
  search: OAuthSearch;
  className?: string;
};

export function AuthorizationContextBanner({
  search,
  className = '',
}: AuthorizationContextBannerProps) {
  if (!hasAuthorizationContext(search)) {
    return null;
  }

  return <AuthorizationContextContent className={className} search={search} />;
}

function AuthorizationContextContent({
  search,
  className,
}: {
  search: AuthorizationContextSearch;
  className: string;
}) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(
    getAuthorizationContextQueryOptions(search),
  );

  return (
    <section
      aria-label={t('authorizationContext.label')}
      className={`mb-5 rounded-lg border border-primary/20 bg-primary/10 p-3 text-left ${className}`}
      data-testid="authorization-context"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-primary/15 p-1.5 text-primary">
          <ShieldCheckIcon aria-hidden className="size-4" weight="fill" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-base-content text-sm">
            {t('authorizationContext.title', { app: data.client.name })}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-base-content/65 text-xs">
            <GlobeSimpleIcon aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">
              {t('authorizationContext.redirect', {
                origin: data.redirect_origin,
              })}
            </span>
          </div>

          <div className="mt-3">
            <p className="font-medium text-base-content/70 text-xs">
              {t('authorizationContext.permissions')}
            </p>
            {data.scopes.length > 0 ? (
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {data.scopes.map((scope) => (
                  <li
                    className="rounded-full bg-base-100/80 px-2 py-1 text-base-content/75 text-xs"
                    key={scope.name}
                  >
                    {t(`consent.scope.${scope.name}`, {
                      defaultValue: scope.description,
                    })}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-base-content/60 text-xs">
                {t('authorizationContext.noScopes')}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

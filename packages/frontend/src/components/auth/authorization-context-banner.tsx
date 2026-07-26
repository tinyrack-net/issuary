import { useSuspenseQuery } from '@tanstack/react-query';
import { GlobeIcon, ShieldCheckIcon } from 'lucide-react';
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
      className={`mb-5 rounded-tinyrack-md border border-tinyrack-info-border bg-tinyrack-info-surface-subtle p-3 text-left ${className}`}
      data-testid="authorization-context"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-tinyrack-full bg-tinyrack-info-surface p-1.5 text-tinyrack-info">
          <ShieldCheckIcon aria-hidden className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-tinyrack-sm text-tinyrack-text">
            {t('authorizationContext.title', { app: data.client.name })}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-tinyrack-text-muted text-tinyrack-xs">
            <GlobeIcon aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">
              {t('authorizationContext.redirect', {
                origin: data.redirect_origin,
              })}
            </span>
          </div>

          <div className="mt-3">
            <p className="font-medium text-tinyrack-text-muted text-tinyrack-xs">
              {t('authorizationContext.permissions')}
            </p>
            {data.scopes.length > 0 ? (
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {data.scopes.map((scope) => (
                  <li
                    className="rounded-tinyrack-full bg-tinyrack-surface px-2 py-1 text-tinyrack-text-muted text-tinyrack-xs"
                    key={scope.name}
                  >
                    {t(`consent.scope.${scope.name}`, {
                      defaultValue: scope.description,
                    })}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-tinyrack-text-muted text-tinyrack-xs">
                {t('authorizationContext.noScopes')}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

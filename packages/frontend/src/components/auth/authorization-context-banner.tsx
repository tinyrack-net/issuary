import { useSuspenseQuery } from '@tanstack/react-query';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRText } from '@tinyrack/ui/components/text';
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
    <TRCard.Root
      aria-label={t('authorizationContext.label')}
      className={className}
      data-testid="authorization-context"
      padding="lg"
      render={<section />}
      variant="outlined"
    >
      <TRCard.Content className="flex flex-col gap-tinyrack-sm">
        <div className="flex items-center gap-tinyrack-sm">
          <ShieldCheckIcon
            aria-hidden
            className="size-tinyrack-lg shrink-0 text-tinyrack-info-foreground"
          />
          <TRText variant="body" weight="medium">
            {t('authorizationContext.title', { app: data.client.name })}
          </TRText>
        </div>

        <div className="flex min-w-0 items-center gap-tinyrack-xs">
          <GlobeIcon
            aria-hidden
            className="size-tinyrack-lg shrink-0 text-tinyrack-text-muted"
          />
          <TRText color="muted" truncate variant="caption">
            {t('authorizationContext.redirect', {
              origin: data.redirect_origin,
            })}
          </TRText>
        </div>

        {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural permissions group containing DS text and badges. */}
        <div className="flex flex-col gap-tinyrack-xs">
          <TRText color="muted" variant="caption" weight="medium">
            {t('authorizationContext.permissions')}
          </TRText>
          {data.scopes.length > 0 ? (
            <ul className="flex flex-wrap gap-tinyrack-xs">
              {data.scopes.map((scope) => (
                <li key={scope.name}>
                  <TRBadge uiSize="md" variant="neutral">
                    {t(`consent.scope.${scope.name}`, {
                      defaultValue: scope.description,
                    })}
                  </TRBadge>
                </li>
              ))}
            </ul>
          ) : (
            <TRText color="muted" variant="caption">
              {t('authorizationContext.noScopes')}
            </TRText>
          )}
        </div>
      </TRCard.Content>
    </TRCard.Root>
  );
}

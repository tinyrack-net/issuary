import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
import { TRText } from '@tinyrack/ui/components/text';
import { CircleAlertIcon, FingerprintIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  AuthFooter,
  AuthFooterLink,
} from '#frontend/components/auth/auth-footer.tsx';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
import { navigateDocument } from '#frontend/libs/document-navigation.ts';
import {
  buildAuthenticatedAuthorizeUrl,
  extractOAuthParams,
  isOAuthFlow,
  OAuthSearchSchema,
} from '#frontend/libs/oauth-search.ts';
import {
  classifyPasskeyError,
  type PasskeyErrorReason,
} from '#frontend/libs/passkey-error.ts';
import { tick } from '#frontend/libs/promise.ts';
import {
  createRouteLoaderData,
  hrefWithSearch,
  parseRequestSearch,
  RouteHydrationBoundary,
} from '#frontend/libs/route-module.tsx';
import { getRouteRuntime } from '#frontend/libs/route-runtime.ts';
import { authenticateWithPasskeyMutationOptions } from '#frontend/queries/passkey.ts';
import { getPendingSecondFactorMethodsQueryOptions } from '#frontend/queries/second-factor.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';

const SearchSchema = OAuthSearchSchema;

import type { Route } from './+types/route.js';

function VerifyPasskey({
  search,
}: {
  search: ReturnType<typeof SearchSchema.parse>;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<{
    message: string;
    reason: PasskeyErrorReason;
  } | null>(null);
  const hasStarted = useRef(false);
  const pendingMethodsQuery = useQuery({
    ...getPendingSecondFactorMethodsQueryOptions,
    enabled: error !== null,
  });
  const canUseTotp =
    pendingMethodsQuery.data?.methods.includes('totp') ?? false;

  const getErrorMessage = (reason: PasskeyErrorReason) => {
    switch (reason) {
      case 'unsupported':
        return t('verifyPasskey.error.unsupported');
      case 'not_allowed':
        return t('verifyPasskey.error.notAllowed');
      case 'expired':
        return t('verifyPasskey.error.expired');
      case 'user_mismatch':
        return t('verifyPasskey.error.userMismatch');
      case 'verification_failed':
        return t('verifyPasskey.error.failed');
    }
  };

  const verifyMutation = useMutation({
    ...authenticateWithPasskeyMutationOptions,
    onSuccess: async (data) => {
      if (data.user) {
        queryClient.setQueryData(getSessionQueryOptions.queryKey, {
          user: data.user,
        });
        await tick();

        if (isOAuthFlow(search)) {
          navigateDocument(buildAuthenticatedAuthorizeUrl(search));
        } else {
          await navigate('/profile');
        }
      }
    },
    onError: async (err) => {
      const reason = classifyPasskeyError(err);
      setError({
        message: getErrorMessage(reason),
        reason,
      });
    },
  });

  // Auto-start passkey authentication on mount (with guard for StrictMode)
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    verifyMutation.mutate();
  }, [verifyMutation]);

  return (
    <AuthLayout>
      {/*
        Centred: this screen has no form to scan, only a device prompt to wait
        on, so the eye has nothing to follow down a left edge.
      */}
      <AuthPageHeader
        align="center"
        subtitle={t('verifyPasskey.subtitle')}
        title={t('verifyPasskey.title')}
      />

      {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural verification state; descendants own visible typography. */}
      <div className="flex flex-col items-center gap-tinyrack-lg">
        <div className="flex size-tinyrack-3xl items-center justify-center rounded-tinyrack-full bg-tinyrack-surface-muted">
          <FingerprintIcon
            aria-hidden
            className="size-tinyrack-2xl text-tinyrack-text-muted"
          />
        </div>

        {verifyMutation.isPending && (
          <div className="flex flex-col items-center gap-tinyrack-sm">
            <TRSpinner uiSize="md" />
            <TRText align="center" as="p" color="muted" variant="bodySm">
              {t('verifyPasskey.waiting')}
            </TRText>
          </div>
        )}

        {error && (
          // tinyrack-check-ignore-next-line components/no-native-text -- Structural error actions; descendants own visible typography.
          <div className="flex w-full flex-col items-center gap-tinyrack-md">
            <Alert className="w-full" icon={CircleAlertIcon} type="error">
              {error.message}
            </Alert>
            {canUseTotp && (
              <TRLinkButton
                className="w-full"
                intent="primary"
                render={
                  <Link
                    to={hrefWithSearch(
                      '/verify/totp',
                      extractOAuthParams(search),
                    )}
                  />
                }
                uiSize="lg"
              >
                {t('verifyPasskey.useTotp')}
              </TRLinkButton>
            )}
            <TRButton
              appearance={canUseTotp ? 'outline' : 'solid'}
              className="w-full"
              intent={canUseTotp ? 'neutral' : 'primary'}
              onClick={() => {
                setError(null);
                verifyMutation.mutate();
              }}
              type="button"
              uiSize="lg"
            >
              {t('verifyPasskey.retry')}
            </TRButton>
          </div>
        )}
      </div>

      <AuthFooter>
        <AuthFooterLink
          link={
            <Link to={hrefWithSearch('/login', search)}>
              {t('verifyPasskey.backToLogin')}
            </Link>
          }
        />
      </AuthFooter>
    </AuthLayout>
  );
}

export function loader({ request, context }: Route.LoaderArgs) {
  const runtime = getRouteRuntime(context);
  return createRouteLoaderData(
    runtime.queryClient,
    parseRequestSearch(request, SearchSchema),
  );
}

export default function VerifyPasskeyRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <VerifyPasskey search={loaderData.search} />
    </RouteHydrationBoundary>
  );
}

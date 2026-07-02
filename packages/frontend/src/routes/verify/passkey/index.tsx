import { FingerprintIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FooterLink } from '#frontend/components/auth/footer-link.tsx';
import { PageHeader } from '#frontend/components/auth/page-header.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { PageLayout } from '#frontend/features/layout/page-layout.tsx';
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
import { authenticateWithPasskeyMutationOptions } from '#frontend/queries/passkey.ts';
import { getPendingSecondFactorMethodsQueryOptions } from '#frontend/queries/second-factor.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';

const SearchSchema = OAuthSearchSchema;

export const Route = createFileRoute('/verify/passkey/')({
  component: VerifyPasskey,
  validateSearch: SearchSchema,
});

function VerifyPasskey() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
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
          window.location.href = buildAuthenticatedAuthorizeUrl(search);
        } else {
          router.navigate({ to: '/profile' });
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
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
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
    <PageLayout cardPadding maxWidth="100">
      <PageHeader
        subtitle={t('verifyPasskey.subtitle')}
        title={t('verifyPasskey.title')}
      />

      <div className="flex flex-col items-center gap-6">
        {verifyMutation.isPending && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-20 items-center justify-center rounded-full bg-base-200">
              <FingerprintIcon className="size-10 animate-pulse text-primary" />
            </div>
            <p className="text-center text-base-content/70 text-sm">
              {t('verifyPasskey.waiting')}
            </p>
          </div>
        )}

        {error && (
          <>
            <Alert className="w-full" icon={WarningCircleIcon} type="error">
              {error.message}
            </Alert>
            {canUseTotp && (
              <Link
                className="btn btn-primary btn-block"
                search={extractOAuthParams(search)}
                to="/verify/totp"
              >
                {t('verifyPasskey.useTotp')}
              </Link>
            )}
            <button
              className={`btn btn-block ${
                canUseTotp ? 'btn-outline' : 'btn-primary'
              }`}
              onClick={() => {
                setError(null);
                verifyMutation.mutate();
              }}
              type="button"
            >
              <FingerprintIcon className="size-5" weight="regular" />
              {t('verifyPasskey.retry')}
            </button>
          </>
        )}
      </div>

      <FooterLink
        as={Link}
        linkText={t('verifyPasskey.backToLogin')}
        search={search}
        text=""
        to="/login"
      />
    </PageLayout>
  );
}

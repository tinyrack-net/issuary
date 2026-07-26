import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
import { CircleAlertIcon, FingerprintIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { FooterLink } from '#frontend/components/auth/footer-link.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
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
    <AuthLayout>
      <AuthPageHeader
        subtitle={t('verifyPasskey.subtitle')}
        title={t('verifyPasskey.title')}
      />

      <div className="flex flex-col items-center gap-6">
        {verifyMutation.isPending && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-20 items-center justify-center rounded-tinyrack-full bg-tinyrack-surface-muted">
              <TRSpinner uiSize="lg" />
            </div>
            <p className="text-center text-tinyrack-sm text-tinyrack-text-muted">
              {t('verifyPasskey.waiting')}
            </p>
          </div>
        )}

        {error && (
          <>
            <Alert className="w-full" icon={CircleAlertIcon} type="error">
              {error.message}
            </Alert>
            {canUseTotp && (
              <TRLinkButton
                className="w-full"
                intent="primary"
                render={
                  <Link search={extractOAuthParams(search)} to="/verify/totp" />
                }
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
            >
              <FingerprintIcon className="size-5" />
              {t('verifyPasskey.retry')}
            </TRButton>
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
    </AuthLayout>
  );
}

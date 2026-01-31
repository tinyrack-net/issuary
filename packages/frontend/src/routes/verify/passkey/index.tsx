import { FingerprintIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FooterLink } from '@/components/auth/footer-link.js';
import { PageHeader } from '@/components/auth/page-header.js';
import { Alert } from '@/components/ui/alert.js';
import { PageLayout } from '@/components/ui/page-layout.js';
import { ApiError } from '@/libs/error.js';
import {
  buildAuthorizeUrl,
  isOAuthFlow,
  OAuthSearchSchema,
} from '@/libs/oauth-search.js';
import { tick } from '@/libs/promise.js';
import { authenticateWithPasskeyMutationOptions } from '@/queries/passkey.js';
import { getSessionQueryOptions } from '@/queries/session.js';

export const SearchSchema = OAuthSearchSchema;

export const Route = createFileRoute('/verify/passkey/')({
  component: VerifyPasskey,
  validateSearch: SearchSchema,
});

function VerifyPasskey() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const hasStarted = useRef(false);

  const verifyMutation = useMutation({
    ...authenticateWithPasskeyMutationOptions,
    onSuccess: async (data) => {
      if (data.user) {
        queryClient.setQueryData(getSessionQueryOptions.queryKey, {
          user: data.user,
        });
        await tick();

        if (isOAuthFlow(search)) {
          window.location.href = buildAuthorizeUrl(search);
        } else {
          router.navigate({ to: '/profile' });
        }
      }
    },
    onError: async (err) => {
      if (err instanceof ApiError) {
        if (err.code === 'SECOND_FACTOR_SESSION_EXPIRED') {
          setError(t('verifyPasskey.error.expired'));
          return;
        }
        if (err.code === 'PASSKEY_USER_MISMATCH') {
          setError(t('verifyPasskey.error.userMismatch'));
          return;
        }
      } else {
        setError(t('verifyPasskey.error.failed'));
        return;
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyMutation.mutate]);

  return (
    <PageLayout maxWidth="100" cardPadding>
      <PageHeader
        title={t('verifyPasskey.title')}
        subtitle={t('verifyPasskey.subtitle')}
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
            <Alert type="error" icon={WarningCircleIcon} className="w-full">
              {error}
            </Alert>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => {
                setError(null);
                verifyMutation.mutate();
              }}
            >
              <FingerprintIcon className="size-5" weight="regular" />
              {t('verifyPasskey.retry')}
            </button>
          </>
        )}
      </div>

      <FooterLink
        text=""
        linkText={t('verifyPasskey.backToLogin')}
        to="/login"
        search={search}
      />
    </PageLayout>
  );
}

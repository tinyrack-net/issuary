import { FooterLink } from '@frontend/components/auth/footer-link.js';
import { PageHeader } from '@frontend/components/auth/page-header.js';
import { Alert } from '@frontend/components/ui/alert.js';
import { PageLayout } from '@frontend/components/ui/page-layout.js';
import { TinyAuthError } from '@frontend/libs/error.js';
import {
  buildAuthorizeUrl,
  isOAuthFlow,
  OAuthSearchSchema,
} from '@frontend/libs/oauth-search.js';
import { tick } from '@frontend/libs/promise.js';
import { authenticateWithPasskeyMutationOptions } from '@frontend/queries/passkey.js';
import { getSessionQueryOptions } from '@frontend/queries/session.js';
import { FingerprintIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
      if (err instanceof TinyAuthError) {
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
              {error}
            </Alert>
            <button
              className="btn btn-primary btn-block"
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

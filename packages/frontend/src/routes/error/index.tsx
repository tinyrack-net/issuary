import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRLink } from '@tinyrack/ui/components/link';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { CircleAlertIcon, HouseIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AuthPageHeader } from '#frontend/components/auth/auth-page-header.tsx';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';

const errorSearchSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
});

export const Route = createFileRoute('/error/')({
  component: ErrorPage,
  validateSearch: errorSearchSchema,
});

function ErrorPage() {
  const { t } = useTranslation();
  const search = useSearch({ from: '/error/' });

  const errorCode = search.code || 'UNKNOWN_ERROR';
  const errorMessage = search.message || t('error.defaultMessage');

  return (
    <AuthLayout>
      <Alert className="mb-4" icon={CircleAlertIcon} type="error">
        {t('error.title')}
      </Alert>

      <AuthPageHeader subtitle={errorMessage} title={t('error.subtitle')} />

      {/* Error Code */}
      <div className="mb-6 rounded-tinyrack-md bg-tinyrack-surface-muted p-4 text-center">
        <p className="mb-1 text-tinyrack-text-muted text-tinyrack-xs">
          {t('error.codeLabel')}
        </p>
        <code
          className="font-mono text-tinyrack-danger text-tinyrack-sm"
          data-testid="error-code"
        >
          {errorCode}
        </code>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <TRLinkButton
          className="w-full font-semibold"
          intent="primary"
          render={<Link to="/login" />}
        >
          {t('error.goToLogin')}
        </TRLinkButton>
        <TRButton
          appearance="outline"
          className="w-full font-semibold"
          intent="neutral"
          onClick={() => window.history.back()}
          type="button"
        >
          <HouseIcon className="size-4" />
          {t('error.goBack')}
        </TRButton>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-tinyrack-text-muted text-tinyrack-xs">
        {t('error.footer.needHelp')}{' '}
        <TRLink className="font-medium" href="mailto:support@example.com">
          {t('error.footer.contactSupport')}
        </TRLink>
      </div>
    </AuthLayout>
  );
}

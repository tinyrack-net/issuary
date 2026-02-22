import { PageHeader } from '@frontend/components/auth/page-header.js';
import { Alert } from '@frontend/components/ui/alert.js';
import { PageLayout } from '@frontend/features/layout/page-layout.js';
import { HouseIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

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
    <PageLayout cardPadding maxWidth="100">
      <Alert className="mb-4" icon={WarningCircleIcon} type="error">
        {t('error.title')}
      </Alert>

      <PageHeader subtitle={errorMessage} title={t('error.subtitle')} />

      {/* Error Code */}
      <div className="mb-6 rounded-lg bg-base-200 p-4 text-center">
        <p className="mb-1 text-base-content/50 text-xs">
          {t('error.codeLabel')}
        </p>
        <code className="font-mono text-error text-sm">{errorCode}</code>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Link
          className="btn btn-block h-10 font-semibold text-[14px]"
          to="/login"
        >
          {t('error.goToLogin')}
        </Link>
        <button
          className="btn btn-ghost btn-block h-10 font-semibold text-[14px]"
          onClick={() => window.history.back()}
          type="button"
        >
          <HouseIcon className="size-4" weight="fill" />
          {t('error.goBack')}
        </button>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-base-content/70 text-xs">
        {t('error.footer.needHelp')}{' '}
        <a
          className="link link-info font-medium"
          href="mailto:support@example.com"
        >
          {t('error.footer.contactSupport')}
        </a>
      </div>
    </PageLayout>
  );
}

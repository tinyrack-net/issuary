import { House, WarningCircle } from '@phosphor-icons/react';
import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { AuthPageLayout, PageHeader } from '@/components/auth/index.js';
import { Alert } from '@/components/ui/index.js';

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
    <AuthPageLayout>
      <Alert type="error" icon={WarningCircle} className="mb-4">
        {t('error.title')}
      </Alert>

      <PageHeader title={t('error.subtitle')} subtitle={errorMessage} />

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
          to="/login"
          className="btn btn-block h-10 font-semibold text-[14px]"
        >
          {t('error.goToLogin')}
        </Link>
        <button
          type="button"
          className="btn btn-ghost btn-block h-10 font-semibold text-[14px]"
          onClick={() => window.history.back()}
        >
          <House className="size-4" weight="fill" />
          {t('error.goBack')}
        </button>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-base-content/70 text-xs">
        {t('error.footer.needHelp')}{' '}
        <a
          href="mailto:support@example.com"
          className="link link-info font-medium"
        >
          {t('error.footer.contactSupport')}
        </a>
      </div>
    </AuthPageLayout>
  );
}

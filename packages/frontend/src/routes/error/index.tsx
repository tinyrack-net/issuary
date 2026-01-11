import { House, Moon, Sun, WarningCircle } from '@phosphor-icons/react';
import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { useTheme } from '@/hooks/use-theme';

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
  const { theme, toggleDarkMode } = useTheme();
  const search = useSearch({ from: '/error/' });

  const errorCode = search.code || 'UNKNOWN_ERROR';
  const errorMessage = search.message || t('error.defaultMessage');

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover p-4"
      style={{
        backgroundImage:
          'url(https://images.unsplash.com/photo-1508163223045-1880bc36e222?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2071)',
      }}
    >
      {/* Theme Toggle */}
      <label className="swap swap-rotate btn btn-sm btn-circle absolute start-4 top-4">
        <input
          type="checkbox"
          checked={theme === 'dark'}
          onChange={toggleDarkMode}
        />
        <Sun className="swap-off size-4" weight="fill" />
        <Moon className="swap-on size-4" weight="fill" />
      </label>

      <div className="card w-full max-w-100 border border-base-200 bg-base-100 p-12 shadow-lg">
        {/* Error Alert */}
        <div className="alert alert-error mb-4">
          <WarningCircle className="size-5" weight="fill" />
          <span>{t('error.title')}</span>
        </div>

        {/* Header */}
        <h1 className="mb-2 text-center font-bold text-3xl">
          {t('error.subtitle')}
        </h1>
        <p className="mb-6 text-center text-base-content/60 text-xs">
          {errorMessage}
        </p>

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
      </div>
    </div>
  );
}

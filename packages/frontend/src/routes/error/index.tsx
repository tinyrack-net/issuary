import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { TRText } from '@tinyrack/ui/components/text';
import { CircleAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  AuthFooter,
  AuthFooterLink,
} from '#frontend/components/auth/auth-footer.tsx';
import { AuthOutcome } from '#frontend/components/auth/auth-outcome.tsx';
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
      {/*
        Nothing to do here but report what happened, so this is the shared
        terminal-state composition rather than an alert stacked on a header.
      */}
      <AuthOutcome
        description={errorMessage}
        icon={CircleAlertIcon}
        title={t('error.subtitle')}
        tone="danger"
      >
        {/*
          Mono on the code itself, not the label: a font utility on `TRText`
          loses to the component's own per-variant `font-family` rule, and only
          the identifier needs fixed-width anyway.
        */}
        <TRText color="muted" variant="caption">
          {t('error.codeLabel')}{' '}
          <span className="font-tinyrack-mono" data-testid="error-code">
            {errorCode}
          </span>
        </TRText>

        <TRLinkButton
          className="w-full"
          intent="primary"
          render={<Link to="/login" />}
          uiSize="lg"
        >
          {t('error.goToLogin')}
        </TRLinkButton>
        <TRButton
          appearance="ghost"
          className="w-full"
          intent="neutral"
          onClick={() => window.history.back()}
          type="button"
          uiSize="lg"
        >
          {t('error.goBack')}
        </TRButton>
      </AuthOutcome>

      <AuthFooter>
        <AuthFooterLink
          link={
            <a href="mailto:support@example.com">
              {t('error.footer.contactSupport')}
            </a>
          }
          text={t('error.footer.needHelp')}
        />
      </AuthFooter>
    </AuthLayout>
  );
}

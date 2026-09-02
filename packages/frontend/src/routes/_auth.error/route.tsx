import { TRButton } from '@tinyrack/ui/components/button';
import { TRCode } from '@tinyrack/ui/components/code';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { TRText } from '@tinyrack/ui/components/text';
import { CircleAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { z } from 'zod';
import {
  AuthFooter,
  AuthFooterLink,
} from '#frontend/components/auth/auth-footer.tsx';
import { AuthOutcome } from '#frontend/components/auth/auth-outcome.tsx';
import { AuthLayout } from '#frontend/features/layout/auth-layout.tsx';
import {
  createRouteLoaderData,
  parseRequestSearch,
  RouteHydrationBoundary,
} from '#frontend/libs/route-module.tsx';
import { getRouteRuntime } from '#frontend/libs/route-runtime.ts';
import type { Route } from './+types/route.js';

const errorSearchSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
});

type ErrorSearch = z.infer<typeof errorSearchSchema>;

function ErrorPage({ search }: { search: ErrorSearch }) {
  const { t } = useTranslation();

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
          <TRCode data-testid="error-code">{errorCode}</TRCode>
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

export function loader({ request, context }: Route.LoaderArgs) {
  const runtime = getRouteRuntime(context);
  return createRouteLoaderData(
    runtime.queryClient,
    parseRequestSearch(request, errorSearchSchema),
  );
}

export default function ErrorRoute({ loaderData }: Route.ComponentProps) {
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <ErrorPage search={loaderData.search} />
    </RouteHydrationBoundary>
  );
}

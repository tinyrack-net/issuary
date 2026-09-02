import { TRSelect } from '@tinyrack/ui/components/select';
import { TRText } from '@tinyrack/ui/components/text';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '#frontend/features/layout/language-selector.tsx';
import { useColorScheme } from '#frontend/hooks/use-theme.ts';
import {
  createRouteLoaderData,
  RouteHydrationBoundary,
} from '#frontend/libs/route-module.tsx';
import { getRouteRuntime } from '#frontend/libs/route-runtime.ts';
import type { Route } from './+types/route.js';

function AdminSettingsPage() {
  const { t } = useTranslation();
  const { colorScheme, setColorScheme } = useColorScheme();
  const themeOptions = [
    ['light', t('common.theme.light')],
    ['dark', t('common.theme.dark')],
  ];

  return (
    <div className="mx-auto flex w-full max-w-tinyrack-measure-xl flex-col gap-tinyrack-2xl">
      <header className="flex flex-col gap-tinyrack-xs">
        <TRText as="h1" variant="headingMd" weight="heading">
          {t('admin.settings.title')}
        </TRText>
        <TRText as="p" color="muted" variant="bodySm">
          {t('admin.settings.description')}
        </TRText>
      </header>

      <section className="grid items-start gap-tinyrack-md sm:grid-cols-2">
        <div className="flex flex-col gap-tinyrack-xs">
          <TRText as="h2" variant="headingSm">
            {t('admin.settings.language')}
          </TRText>
          <TRText as="p" color="muted" variant="bodySm">
            {t('admin.settings.languageDescription')}
          </TRText>
        </div>
        <LanguageSelector
          alwaysVisible
          className="w-full sm:justify-self-end"
          presentation="field"
          triggerClassName="w-full min-w-full"
          uiSize="md"
        />
      </section>

      <section className="grid items-start gap-tinyrack-md sm:grid-cols-2">
        <div className="flex flex-col gap-tinyrack-xs">
          <TRText as="h2" variant="headingSm">
            {t('admin.settings.theme')}
          </TRText>
          <TRText as="p" color="muted" variant="bodySm">
            {t('admin.settings.themeDescription')}
          </TRText>
        </div>
        <TRSelect.Root
          onValueChange={(value) => {
            if (value === 'light' || value === 'dark') setColorScheme(value);
          }}
          value={colorScheme}
        >
          <TRSelect.Trigger
            appearance="solid"
            aria-label={t('admin.settings.theme')}
            className="w-full sm:justify-self-end"
            uiSize="md"
          >
            <TRSelect.Value>
              {themeOptions.find(([value]) => value === colorScheme)?.[1]}
            </TRSelect.Value>
            <TRSelect.Icon>
              <ChevronDownIcon aria-hidden />
            </TRSelect.Icon>
          </TRSelect.Trigger>
          <TRSelect.Portal>
            <TRSelect.Positioner>
              <TRSelect.Popup>
                <TRSelect.List>
                  {themeOptions.map(([value, label]) => (
                    <TRSelect.Item key={value} value={value}>
                      <TRSelect.ItemText>{label}</TRSelect.ItemText>
                      <TRSelect.ItemIndicator>
                        <CheckIcon aria-hidden />
                      </TRSelect.ItemIndicator>
                    </TRSelect.Item>
                  ))}
                </TRSelect.List>
              </TRSelect.Popup>
            </TRSelect.Positioner>
          </TRSelect.Portal>
        </TRSelect.Root>
      </section>
    </div>
  );
}

export function loader({ context }: Route.LoaderArgs) {
  const runtime = getRouteRuntime(context);
  return createRouteLoaderData(runtime.queryClient, {});
}

export default function AdminSettingsRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <AdminSettingsPage />
    </RouteHydrationBoundary>
  );
}

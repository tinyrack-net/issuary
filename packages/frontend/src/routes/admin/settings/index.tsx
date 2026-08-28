import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { TRSelect } from '@tinyrack/ui/components/select';
import { TRText } from '@tinyrack/ui/components/text';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminGateScreen } from '#frontend/features/admin/admin-gate-screen.tsx';
import { AdminShell } from '#frontend/features/admin/admin-shell.tsx';
import { LanguageSelector } from '#frontend/features/layout/language-selector.tsx';
import { useColorScheme } from '#frontend/hooks/use-theme.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import type { SessionUser } from '#frontend/queries/session.ts';

export const Route = createFileRoute('/admin/settings/')({
  component: AdminSettingsPage,
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: '/login' });
  },
});

function AdminSettingsPage() {
  const user = Route.useRouteContext({ select: (context) => context.user });
  if (user?.role !== 'admin')
    return <AdminGateScreen reason="access-required" />;
  return <AdminSettingsGate user={user} />;
}

function AdminSettingsGate({ user }: { user: SessionUser }) {
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);
  if (!config.admin.enabled)
    return <AdminGateScreen reason="console-disabled" />;
  return <AdminSettingsContent user={user} />;
}

function AdminSettingsContent({ user }: { user: SessionUser }) {
  const { t } = useTranslation();
  const { colorScheme, setColorScheme } = useColorScheme();
  const themeOptions = [
    ['light', t('common.theme.light')],
    ['dark', t('common.theme.dark')],
  ];

  return (
    <AdminShell
      current="settings"
      title={t('admin.settings.title')}
      user={user}
    >
      <div className="mx-auto flex w-full max-w-tinyrack-overlay-md flex-col gap-tinyrack-2xl">
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
    </AdminShell>
  );
}

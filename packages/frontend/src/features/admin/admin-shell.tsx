import { Link } from '@tanstack/react-router';
import { TRAppShell } from '@tinyrack/ui/components/app-shell';
import { TRAvatar } from '@tinyrack/ui/components/avatar';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRCard } from '@tinyrack/ui/components/card';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionUser } from '#frontend/queries/session.ts';

type AdminShellProps = {
  user: SessionUser;
  current: 'dashboard' | 'users';
  title: string;
  description: string;
  children: ReactNode;
};

export function AdminShell({
  user,
  current,
  title,
  description,
  children,
}: AdminShellProps) {
  const { t } = useTranslation();

  return (
    <TRAppShell.Root breakpoint="lg" className="min-h-screen bg-background">
      <TRAppShell.Sidebar className="flex w-80 flex-col border-border border-r bg-background p-5">
        <div className="mb-2 flex justify-end lg:hidden">
          <TRAppShell.Close aria-label={t('admin.nav.close')}>
            &times;
          </TRAppShell.Close>
        </div>

        <div className="mb-8 rounded-3xl border border-border bg-muted p-4">
          <div className="flex items-center gap-3">
            <TRAvatar.Root shape="square" uiSize="lg">
              <TRAvatar.Fallback className="bg-gradient-to-br from-primary to-emerald-400 text-primary-foreground">
                TA
              </TRAvatar.Fallback>
            </TRAvatar.Root>
            <div>
              <p className="font-semibold text-foreground">TinyAuth</p>
              <p className="text-muted-foreground text-xs">
                {t('admin.console')}
              </p>
            </div>
          </div>
        </div>

        <ul className="flex w-full flex-col gap-1 p-0">
          <li>
            <AdminNavLink active={current === 'dashboard'} to="/admin">
              {t('admin.nav.dashboard')}
            </AdminNavLink>
          </li>
          <li>
            <AdminNavLink active={current === 'users'} to="/admin/users">
              {t('admin.nav.users')}
            </AdminNavLink>
          </li>
        </ul>

        <TRCard.Root className="mt-auto" variant="outlined">
          <TRCard.Content className="gap-2 p-4">
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.2em]">
              {t('admin.signedInAs')}
            </p>
            <p className="truncate font-medium text-foreground text-sm">
              {user.email}
            </p>
            <div className="mt-2">
              <TRBadge uiSize="sm" variant="neutral">
                {t('admin.roleBadge', {
                  role: formatAdminRole(t, user.role),
                })}
              </TRBadge>
            </div>
          </TRCard.Content>
        </TRCard.Root>
      </TRAppShell.Sidebar>

      <TRAppShell.Header className="sticky top-0 z-20 flex items-center gap-3 border-border border-b bg-background px-4 lg:px-8">
        <div className="flex-none lg:hidden">
          <TRAppShell.Trigger aria-label={t('admin.nav.open')}>
            <span className="text-xl">&#9776;</span>
          </TRAppShell.Trigger>
        </div>
        <div className="min-w-0 flex-1">
          <nav
            aria-label={t('admin.breadcrumbLabel')}
            className="hidden items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-muted-foreground text-sm lg:flex"
          >
            <span>{t('admin.console')}</span>
            <span className="text-border">/</span>
            <span className="font-medium text-foreground">{title}</span>
          </nav>
          <div className="lg:hidden">
            <p className="font-semibold">{t('admin.mobileTitle')}</p>
            <p className="truncate text-muted-foreground text-xs">
              {user.email}
            </p>
          </div>
        </div>
        <div className="flex flex-none items-center gap-3">
          <TRBadge uiSize="sm" variant="neutral">
            {t('admin.environment')}
          </TRBadge>
          <div className="hidden items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-muted-foreground text-xs sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {t('admin.livePolicy')}
          </div>
        </div>
      </TRAppShell.Header>

      <TRAppShell.Main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-8 lg:px-8">
        <TRCard.Root className="mb-8" variant="outlined">
          <TRCard.Header className="p-6 lg:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="font-semibold text-primary text-xs uppercase tracking-[0.26em]">
                  {t('admin.eyebrow')}
                </p>
                <TRCard.Title className="mt-3 font-semibold text-4xl tracking-[-0.055em] lg:text-5xl">
                  {title}
                </TRCard.Title>
                <TRCard.Description className="mt-3 max-w-2xl text-base leading-7">
                  {description}
                </TRCard.Description>
              </div>
              <div className="max-w-xl rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-600 text-sm dark:text-amber-400">
                <span>{t('admin.readonlyNotice')}</span>
              </div>
            </div>
          </TRCard.Header>
        </TRCard.Root>

        {children}
      </TRAppShell.Main>
    </TRAppShell.Root>
  );
}

function formatAdminRole(
  t: ReturnType<typeof useTranslation>['t'],
  role: SessionUser['role'],
) {
  return role === 'admin'
    ? t('admin.users.roleAdmin')
    : t('admin.users.roleUser');
}

type AdminNavLinkProps = {
  active: boolean;
  to: '/admin' | '/admin/users';
  children: ReactNode;
};

function AdminNavLink({ active, to, children }: AdminNavLinkProps) {
  return (
    <Link
      className={
        active
          ? 'active flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2.5 font-medium text-foreground'
          : 'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground'
      }
      to={to}
    >
      <span>{children}</span>
      {active ? (
        <TRBadge className="ml-auto" uiSize="sm" variant="neutral" />
      ) : null}
    </Link>
  );
}

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
    <TRAppShell.Root
      breakpoint="lg"
      className="min-h-screen bg-tinyrack-canvas"
    >
      <TRAppShell.Sidebar className="flex w-80 flex-col border-tinyrack-border border-r bg-tinyrack-surface p-5">
        <div className="mb-2 flex justify-end lg:hidden">
          <TRAppShell.Close aria-label={t('admin.nav.close')}>
            &times;
          </TRAppShell.Close>
        </div>

        <div className="mb-8 rounded-tinyrack-lg border border-tinyrack-border bg-tinyrack-surface-muted p-4">
          <div className="flex items-center gap-3">
            <TRAvatar.Root shape="square" uiSize="lg">
              <TRAvatar.Fallback className="bg-tinyrack-primary text-tinyrack-on-primary">
                TA
              </TRAvatar.Fallback>
            </TRAvatar.Root>
            <div>
              <p className="font-semibold text-tinyrack-text">TinyAuth</p>
              <p className="text-tinyrack-text-muted text-tinyrack-xs">
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
            <p className="font-semibold text-tinyrack-text-muted text-tinyrack-xs uppercase tracking-wide">
              {t('admin.signedInAs')}
            </p>
            <p className="truncate font-medium text-tinyrack-sm text-tinyrack-text">
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

      <TRAppShell.Header className="sticky top-0 z-20 flex items-center gap-3 border-tinyrack-border border-b bg-tinyrack-surface px-4 lg:px-8">
        <div className="flex-none lg:hidden">
          <TRAppShell.Trigger aria-label={t('admin.nav.open')}>
            <span className="text-tinyrack-xl">&#9776;</span>
          </TRAppShell.Trigger>
        </div>
        <div className="min-w-0 flex-1">
          <nav
            aria-label={t('admin.breadcrumbLabel')}
            className="hidden items-center gap-2 rounded-tinyrack-full border border-tinyrack-border bg-tinyrack-surface-muted px-4 py-2 text-tinyrack-sm text-tinyrack-text-muted lg:flex"
          >
            <span>{t('admin.console')}</span>
            <span className="text-tinyrack-text-placeholder">/</span>
            <span className="font-medium text-tinyrack-text">{title}</span>
          </nav>
          <div className="lg:hidden">
            <p className="font-semibold text-tinyrack-text">
              {t('admin.mobileTitle')}
            </p>
            <p className="truncate text-tinyrack-text-muted text-tinyrack-xs">
              {user.email}
            </p>
          </div>
        </div>
        <div className="flex flex-none items-center gap-3">
          <TRBadge uiSize="sm" variant="neutral">
            {t('admin.environment')}
          </TRBadge>
          <div className="hidden items-center gap-2 rounded-tinyrack-full border border-tinyrack-border bg-tinyrack-surface-muted px-3 py-1.5 text-tinyrack-text-muted text-tinyrack-xs sm:flex">
            <span className="h-2 w-2 rounded-tinyrack-full bg-tinyrack-success" />
            {t('admin.livePolicy')}
          </div>
        </div>
      </TRAppShell.Header>

      <TRAppShell.Main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-8 lg:px-8">
        <TRCard.Root className="mb-8" variant="outlined">
          <TRCard.Header className="p-6 lg:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="font-semibold text-tinyrack-primary text-tinyrack-xs uppercase tracking-wide">
                  {t('admin.eyebrow')}
                </p>
                <TRCard.Title className="mt-3 font-semibold text-tinyrack-3xl lg:text-tinyrack-4xl">
                  {title}
                </TRCard.Title>
                <TRCard.Description className="mt-3 max-w-2xl text-tinyrack-md leading-7">
                  {description}
                </TRCard.Description>
              </div>
              <div className="max-w-xl rounded-tinyrack-md border border-tinyrack-warning-border bg-tinyrack-warning-surface px-4 py-3 text-tinyrack-on-warning text-tinyrack-sm">
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
          ? 'active flex items-center gap-2 rounded-tinyrack-md bg-tinyrack-surface-selected px-4 py-2.5 font-medium text-tinyrack-text'
          : 'flex items-center gap-2 rounded-tinyrack-md px-4 py-2.5 text-tinyrack-text-muted hover:bg-tinyrack-surface-hover hover:text-tinyrack-text'
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

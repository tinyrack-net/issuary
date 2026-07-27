import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { TRAppShell } from '@tinyrack/ui/components/app-shell';
import { TRAvatar } from '@tinyrack/ui/components/avatar';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRText } from '@tinyrack/ui/components/text';
import {
  ChevronRightIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  type LucideIcon,
  MenuIcon,
  ShieldIcon,
  TriangleAlertIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '#frontend/components/ui/alert.tsx';
import { ThemeToggle } from '#frontend/components/ui/theme-toggle.tsx';
import { Toaster } from '#frontend/components/ui/toaster.tsx';
import { formatAdminRole } from '#frontend/features/admin/format-admin-user.ts';
import { LanguageSelector } from '#frontend/features/layout/language-selector.tsx';
import { useBranding } from '#frontend/features/layout/use-branding.ts';
import { useColorScheme } from '#frontend/hooks/use-theme.ts';
import { tick } from '#frontend/libs/promise.ts';
import { logoutMutationOptions } from '#frontend/queries/logout.ts';
import {
  getSessionQueryOptions,
  type SessionUser,
} from '#frontend/queries/session.ts';

type AdminShellProps = {
  user: SessionUser;
  current: 'dashboard' | 'users';
  title: string;
  description: string;
  children: ReactNode;
};

/**
 * The admin console's chrome.
 *
 * Stays on `TRAppShell` — a dashboard with persistent nav is what that
 * primitive is for, and the split-canvas auth shell would have nowhere to put
 * the sidebar. What changes is everything inside it: the console had no theme
 * toggle, no language selector, no way to sign out, and no toast viewport,
 * which made it the one authenticated surface where the presentation controls
 * simply vanished.
 */
export function AdminShell({
  user,
  current,
  title,
  description,
  children,
}: AdminShellProps) {
  const { t } = useTranslation();
  const { title: brandTitle, iconUrl } = useBranding();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const logoutMutation = useMutation({
    ...logoutMutationOptions,
    onSuccess: async () => {
      queryClient.setQueryData(getSessionQueryOptions.queryKey, { user: null });
      await tick();
      router.navigate({ to: '/login' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
  });

  return (
    <TRAppShell.Root breakpoint="lg" className="bg-tinyrack-canvas">
      <Toaster />

      {/*
        No `w-*` here: `app-shell.css` sizes the sidebar track itself, and the
        20rem this used to declare overflowed the 18rem track it sits in.
      */}
      <TRAppShell.Sidebar className="flex flex-col gap-tinyrack-xl border-tinyrack-border border-r bg-tinyrack-surface p-tinyrack-lg">
        {/* The design system hides this outside the mobile drawer. */}
        <TRAppShell.Close aria-label={t('admin.nav.close')}>
          <XIcon aria-hidden className="size-4" />
        </TRAppShell.Close>

        <div className="flex items-center gap-tinyrack-md">
          {iconUrl ? (
            <img alt="" className="size-8 object-contain" src={iconUrl} />
          ) : (
            <TRAvatar.Root shape="square" uiSize="lg">
              <TRAvatar.Fallback className="bg-tinyrack-primary text-tinyrack-on-primary">
                <ShieldIcon aria-hidden className="size-5" />
              </TRAvatar.Fallback>
            </TRAvatar.Root>
          )}
          <div className="min-w-0">
            <TRText as="p" truncate weight="medium">
              {brandTitle ?? t('admin.mobileTitle')}
            </TRText>
            <TRText as="p" color="muted" variant="caption">
              {t('admin.console')}
            </TRText>
          </div>
        </div>

        <ul className="flex w-full flex-col gap-tinyrack-xs p-0">
          <li>
            <AdminNavLink
              active={current === 'dashboard'}
              icon={LayoutDashboardIcon}
              to="/admin"
            >
              {t('admin.nav.dashboard')}
            </AdminNavLink>
          </li>
          <li>
            <AdminNavLink
              active={current === 'users'}
              icon={UsersIcon}
              to="/admin/users"
            >
              {t('admin.nav.users')}
            </AdminNavLink>
          </li>
        </ul>

        {/*
          Sign-out lives beside the identity it signs out of, the same
          adjacency the profile header uses. The console previously offered no
          way out at all.
        */}
        <div className="mt-auto flex flex-col items-start gap-tinyrack-sm border-tinyrack-border border-t pt-tinyrack-lg">
          <TRText color="muted" variant="label">
            {t('admin.signedInAs')}
          </TRText>
          <TRText as="p" className="w-full" truncate variant="bodySm">
            {user.email}
          </TRText>
          <TRBadge uiSize="sm" variant="neutral">
            {t('admin.roleBadge', { role: formatAdminRole(t, user.role) })}
          </TRBadge>
          <TRButton
            appearance="ghost"
            data-testid="admin-logout"
            disabled={logoutMutation.isPending}
            loading={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
            type="button"
            uiSize="sm"
          >
            <LogOutIcon aria-hidden className="size-4" />
            {t('profile.logout')}
          </TRButton>
        </div>
      </TRAppShell.Sidebar>

      <TRAppShell.Header className="sticky top-0 z-tinyrack-dropdown flex items-center gap-tinyrack-md border-tinyrack-border border-b bg-tinyrack-surface px-tinyrack-lg lg:px-tinyrack-2xl">
        <TRAppShell.Trigger aria-label={t('admin.nav.open')}>
          <MenuIcon aria-hidden className="size-5" />
        </TRAppShell.Trigger>

        <TRAppShell.Brand className="min-w-0">
          <nav
            aria-label={t('admin.breadcrumbLabel')}
            className="hidden items-center gap-tinyrack-sm lg:flex"
          >
            <TRText color="muted" variant="bodySm">
              {t('admin.console')}
            </TRText>
            <ChevronRightIcon
              aria-hidden
              className="size-4 text-tinyrack-text-placeholder"
            />
            <TRText variant="bodySm" weight="medium">
              {title}
            </TRText>
          </nav>
          <div className="min-w-0 lg:hidden">
            <TRText as="p" truncate weight="medium">
              {t('admin.mobileTitle')}
            </TRText>
            <TRText as="p" color="muted" truncate variant="caption">
              {user.email}
            </TRText>
          </div>
        </TRAppShell.Brand>

        {/*
          Language then theme, matching the auth header bar, so the two shells
          put the same control in the same place.
        */}
        <TRAppShell.Actions>
          <div className="hidden items-center gap-tinyrack-xs rounded-tinyrack-full border border-tinyrack-border bg-tinyrack-surface-muted px-tinyrack-md py-tinyrack-xs sm:flex">
            <span
              aria-hidden
              className="size-tinyrack-sm rounded-tinyrack-full bg-tinyrack-success"
            />
            <TRText color="muted" variant="caption">
              {t('admin.livePolicy')}
            </TRText>
          </div>
          <TRBadge uiSize="sm" variant="neutral">
            {t('admin.environment')}
          </TRBadge>
          <LanguageSelector />
          <ThemeToggle colorScheme={colorScheme} onToggle={toggleColorScheme} />
        </TRAppShell.Actions>
      </TRAppShell.Header>

      <TRAppShell.Main className="mx-auto flex w-full max-w-tinyrack-page-xl flex-1 flex-col gap-tinyrack-xl px-tinyrack-lg py-tinyrack-2xl lg:px-tinyrack-2xl">
        {/*
          Not a card. A card around nothing but a title is a box for its own
          sake, and it made the page's real content look like a peer of its
          heading rather than its subject.
        */}
        <header className="flex flex-col gap-tinyrack-xl xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 flex-col gap-tinyrack-md">
            <TRText color="primary" variant="label">
              {t('admin.eyebrow')}
            </TRText>
            <TRText as="h1" variant="display">
              {title}
            </TRText>
            <TRText
              as="p"
              className="max-w-tinyrack-reading-sm"
              color="muted"
              variant="body"
            >
              {description}
            </TRText>
          </div>
          <Alert
            className="max-w-tinyrack-measure-2xl"
            icon={TriangleAlertIcon}
            type="warning"
          >
            {t('admin.readonlyNotice')}
          </Alert>
        </header>

        {children}
      </TRAppShell.Main>
    </TRAppShell.Root>
  );
}

type AdminNavLinkProps = {
  active: boolean;
  icon: LucideIcon;
  to: '/admin' | '/admin/users';
  children: ReactNode;
};

function AdminNavLink({ active, icon: Icon, to, children }: AdminNavLinkProps) {
  return (
    <Link
      className={`flex items-center gap-tinyrack-sm rounded-tinyrack-md px-tinyrack-lg py-tinyrack-sm ${
        active
          ? 'bg-tinyrack-surface-selected font-tinyrack-medium text-tinyrack-text'
          : 'text-tinyrack-text-muted hover:bg-tinyrack-surface-hover hover:text-tinyrack-text'
      }`}
      to={to}
    >
      <Icon aria-hidden className="size-4" />
      <span>{children}</span>
    </Link>
  );
}

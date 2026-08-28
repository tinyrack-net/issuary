import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { TRAppShell } from '@tinyrack/ui/components/app-shell';
import { TRAvatar } from '@tinyrack/ui/components/avatar';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRIconButton } from '@tinyrack/ui/components/icon-button';
import { TRInput } from '@tinyrack/ui/components/input';
import { TRMenu } from '@tinyrack/ui/components/menu';
import { TRText } from '@tinyrack/ui/components/text';
import {
  BookOpenIcon,
  BoxesIcon,
  CommandIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  type LucideIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '#frontend/components/ui/modal.tsx';
import { Toaster } from '#frontend/components/ui/toaster.tsx';
import { formatAdminRole } from '#frontend/features/admin/format-admin-user.ts';
import { useBranding } from '#frontend/features/layout/use-branding.ts';
import { tick } from '#frontend/libs/promise.ts';
import { searchAdmin } from '#frontend/queries/admin-console.ts';
import { logoutMutationOptions } from '#frontend/queries/logout.ts';
import {
  getSessionQueryOptions,
  type SessionUser,
} from '#frontend/queries/session.ts';

export type AdminSection =
  | 'dashboard'
  | 'users'
  | 'clients'
  | 'terms'
  | 'system'
  | 'settings';

type AdminShellProps = {
  user: SessionUser;
  current: AdminSection;
  title: string;
  description?: string | undefined;
  children: ReactNode;
};

const NAV_ITEMS: Array<{
  section: AdminSection;
  icon: LucideIcon;
  to:
    | '/admin'
    | '/admin/users'
    | '/admin/clients'
    | '/admin/terms'
    | '/admin/system';
  label: string;
}> = [
  {
    section: 'dashboard',
    icon: LayoutDashboardIcon,
    to: '/admin',
    label: 'admin.nav.dashboard',
  },
  {
    section: 'users',
    icon: UsersIcon,
    to: '/admin/users',
    label: 'admin.nav.users',
  },
  {
    section: 'clients',
    icon: BoxesIcon,
    to: '/admin/clients',
    label: 'admin.nav.clients',
  },
  {
    section: 'terms',
    icon: BookOpenIcon,
    to: '/admin/terms',
    label: 'admin.nav.terms',
  },
  {
    section: 'system',
    icon: SettingsIcon,
    to: '/admin/system',
    label: 'admin.nav.system',
  },
];

export function AdminShell({
  user,
  current,
  title,
  children,
}: AdminShellProps) {
  const { t } = useTranslation();
  const { title: brandTitle, iconUrl } = useBranding();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
    <TRAppShell.Root
      breakpoint="lg"
      className="admin-app-shell bg-tinyrack-surface"
      sidebarMode="expanded"
    >
      <Toaster />
      <TRAppShell.Sidebar
        aria-label={t('admin.console')}
        className="bg-tinyrack-surface-muted [&_.tr-scroll-area-content]:flex [&_.tr-scroll-area-content]:min-h-full [&_.tr-scroll-area-content]:min-w-full [&_.tr-scroll-area-content]:flex-col [&_.tr-scroll-area-content]:p-tinyrack-md"
      >
        <TRAppShell.Close aria-label={t('admin.nav.close')}>
          <XIcon aria-hidden />
        </TRAppShell.Close>
        {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural brand row; visible descendants use design-system typography. */}
        <div className="mb-tinyrack-xl flex items-center gap-tinyrack-sm px-tinyrack-sm">
          {iconUrl ? (
            <img
              alt=""
              className="size-tinyrack-xl object-contain"
              src={iconUrl}
            />
          ) : (
            <TRAvatar.Root shape="square" uiSize="md">
              <TRAvatar.Fallback>
                <ShieldIcon aria-hidden />
              </TRAvatar.Fallback>
            </TRAvatar.Root>
          )}
          <div className="min-w-0">
            <TRText as="p" truncate variant="bodySm" weight="strong">
              {brandTitle ?? t('admin.mobileTitle')}
            </TRText>
            <TRText as="p" color="muted" variant="caption">
              {t('admin.console')}
            </TRText>
          </div>
        </div>
        <nav aria-label={t('admin.console')}>
          <ul className="flex flex-col gap-tinyrack-xs p-0">
            {NAV_ITEMS.map((item) => (
              <li key={item.section}>
                <AdminNavLink
                  active={current === item.section}
                  icon={item.icon}
                  to={item.to}
                >
                  {t(item.label)}
                </AdminNavLink>
              </li>
            ))}
          </ul>
        </nav>
      </TRAppShell.Sidebar>

      <TRAppShell.Header className="admin-titlebar relative sticky top-0 z-tinyrack-chrome flex items-center gap-tinyrack-sm border-tinyrack-border border-b-tinyrack-default bg-tinyrack-surface px-tinyrack-lg">
        <TRAppShell.Trigger aria-label={t('admin.nav.open')}>
          <MenuIcon aria-hidden />
        </TRAppShell.Trigger>
        <TRAppShell.Brand className="min-w-0">
          <TRText as="p" truncate variant="bodySm" weight="strong">
            {title}
          </TRText>
        </TRAppShell.Brand>
        <TRButton
          appearance="outline"
          className="admin-header-search absolute hidden min-w-tinyrack-overlay-width-sm text-tinyrack-text-muted lg:flex"
          onClick={() => setSearchOpen(true)}
          type="button"
          uiSize="md"
        >
          <SearchIcon aria-hidden className="size-tinyrack-md" />
          <TRText as="span" className="flex-1 text-left" variant="caption">
            {t('admin.search.placeholder')}
          </TRText>
          <kbd className="flex items-center gap-tinyrack-3xs">
            <CommandIcon aria-hidden className="size-tinyrack-sm" />K
          </kbd>
        </TRButton>
        <TRAppShell.Actions className="gap-tinyrack-xs">
          <TRBadge
            className="hidden sm:inline-flex"
            uiSize="md"
            variant="neutral"
          >
            {t('admin.environment')}
          </TRBadge>
          <TRIconButton
            appearance="ghost"
            aria-label={t('admin.search.title')}
            className="lg:hidden"
            onClick={() => setSearchOpen(true)}
            type="button"
            uiSize="md"
          >
            <SearchIcon aria-hidden />
          </TRIconButton>
          <AdminAccountMenu
            email={user.email}
            logoutPending={logoutMutation.isPending}
            onLogout={() => logoutMutation.mutate()}
            role={formatAdminRole(t, user.role)}
          />
        </TRAppShell.Actions>
      </TRAppShell.Header>

      <TRAppShell.Main className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col gap-tinyrack-lg overflow-y-auto px-tinyrack-lg py-tinyrack-lg lg:px-tinyrack-xl">
        {children}
      </TRAppShell.Main>
      <AdminGlobalSearch
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </TRAppShell.Root>
  );
}

function AdminAccountMenu({
  email,
  role,
  logoutPending,
  onLogout,
}: {
  email: string;
  role: string;
  logoutPending: boolean;
  onLogout: () => void;
}) {
  const { t } = useTranslation();
  return (
    <TRMenu.Root>
      <TRMenu.Trigger
        render={
          <TRIconButton
            appearance="ghost"
            aria-label={t('admin.account.menu')}
            uiSize="md"
          >
            <TRAvatar.Root uiSize="md">
              <TRAvatar.Fallback>
                {email.slice(0, 1).toLocaleUpperCase()}
              </TRAvatar.Fallback>
            </TRAvatar.Root>
          </TRIconButton>
        }
      />
      <TRMenu.Portal>
        <TRMenu.Positioner align="end">
          <TRMenu.Popup>
            <div className="flex min-w-0 flex-col gap-tinyrack-3xs px-tinyrack-sm py-tinyrack-xs">
              <TRText as="p" truncate variant="bodySm" weight="strong">
                {email}
              </TRText>
              <TRText as="p" color="muted" variant="caption">
                {role}
              </TRText>
            </div>
            <TRMenu.Separator />
            <TRMenu.LinkItem render={<Link to="/admin/settings" />}>
              <SettingsIcon aria-hidden />
              {t('admin.settings.title')}
            </TRMenu.LinkItem>
            <TRMenu.Item disabled={logoutPending} onClick={onLogout}>
              <LogOutIcon aria-hidden />
              {t('profile.logout')}
            </TRMenu.Item>
          </TRMenu.Popup>
        </TRMenu.Positioner>
      </TRMenu.Portal>
    </TRMenu.Root>
  );
}

function AdminNavLink({
  active,
  icon: Icon,
  to,
  children,
}: {
  active: boolean;
  icon: LucideIcon;
  to:
    | '/admin'
    | '/admin/users'
    | '/admin/clients'
    | '/admin/terms'
    | '/admin/system';
  children: ReactNode;
}) {
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-tinyrack-sm rounded-tinyrack-md px-tinyrack-sm py-tinyrack-sm ${active ? 'bg-tinyrack-surface-selected text-tinyrack-text' : 'text-tinyrack-text-muted hover:bg-tinyrack-surface-hover'}`}
      to={to}
    >
      <Icon aria-hidden className="size-tinyrack-lg shrink-0" />
      <TRAppShell.SidebarLabel>
        <TRText
          as="span"
          color={active ? 'default' : 'muted'}
          variant="bodySm"
          weight={active ? 'strong' : 'regular'}
        >
          {children}
        </TRText>
      </TRAppShell.SidebarLabel>
    </Link>
  );
}

function AdminGlobalSearch({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const menuRows = NAV_ITEMS.filter((item) =>
    t(item.label)
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'search', query],
    queryFn: () => searchAdmin(query),
    enabled: isOpen && query.trim().length > 0,
  });
  return (
    <Modal
      description={t('admin.search.description')}
      isOpen={isOpen}
      onClose={onClose}
      title={t('admin.search.title')}
    >
      {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural search-results stack; visible descendants use design-system typography. */}
      <div className="flex flex-col gap-tinyrack-md pt-tinyrack-lg">
        <TRInput
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('admin.search.placeholder')}
          value={query}
        />
        {isFetching ? (
          <TRText color="muted" variant="bodySm">
            {t('admin.search.loading')}
          </TRText>
        ) : null}
        {data ? (
          /* tinyrack-check-ignore-next-line components/no-native-text -- Structural result scroller; visible descendants use design-system typography. */
          <div className="flex max-h-tinyrack-overlay-width-sm flex-col overflow-y-auto">
            {menuRows.length > 0 ? (
              <section className="border-tinyrack-border border-t-tinyrack-default py-tinyrack-sm">
                <TRText color="muted" variant="label">
                  {t('admin.search.menu')}
                </TRText>
                {menuRows.map((row) => (
                  <Link
                    className="flex rounded-tinyrack-sm px-tinyrack-sm py-tinyrack-xs hover:bg-tinyrack-surface-hover"
                    key={row.section}
                    onClick={onClose}
                    to={row.to}
                  >
                    <TRText variant="bodySm">{t(row.label)}</TRText>
                  </Link>
                ))}
              </section>
            ) : null}
            <SearchGroup
              label={t('admin.nav.users')}
              onClose={onClose}
              rows={data.users}
              to="/admin/users"
            />
            <SearchGroup
              label={t('admin.nav.clients')}
              onClose={onClose}
              rows={data.clients}
              to="/admin/clients"
            />
            <SearchGroup
              label={t('admin.nav.terms')}
              onClose={onClose}
              rows={data.terms}
              to="/admin/terms"
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function SearchGroup({
  label,
  rows,
  to,
  onClose,
}: {
  label: string;
  rows: Array<{ id: string; title: string; subtitle: string }>;
  to: '/admin/users' | '/admin/clients' | '/admin/terms';
  onClose: () => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="border-tinyrack-border border-t-tinyrack-default py-tinyrack-sm">
      <TRText color="muted" variant="label">
        {label}
      </TRText>
      {rows.map((row) => (
        <Link
          className="flex flex-col rounded-tinyrack-sm px-tinyrack-sm py-tinyrack-xs hover:bg-tinyrack-surface-hover"
          key={row.id}
          onClick={onClose}
          to={to}
        >
          <TRText variant="bodySm">{row.title}</TRText>
          <TRText color="muted" variant="caption">
            {row.subtitle}
          </TRText>
        </Link>
      ))}
    </section>
  );
}

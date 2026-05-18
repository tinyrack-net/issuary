import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminSessionQueryOptions } from '#admin/queries/admin.js';

const navItems = [
  { icon: 'dashboard', to: '/', labelKey: 'nav.dashboard' },
  { icon: 'users', to: '/users', labelKey: 'nav.users' },
  {
    icon: 'providers',
    to: '/oauth-providers',
    labelKey: 'nav.oauthProviders',
  },
  { icon: 'clients', to: '/oauth-clients', labelKey: 'nav.oauthClients' },
];

type NavIconName = (typeof navItems)[number]['icon'];

function IconSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

function NavIcon({ name }: { name: NavIconName }) {
  if (name === 'dashboard') {
    return (
      <IconSvg>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
      </IconSvg>
    );
  }

  if (name === 'users') {
    return (
      <IconSvg>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </IconSvg>
    );
  }

  if (name === 'providers') {
    return (
      <IconSvg>
        <circle cx="12" cy="12" r="9" />
        <path d="M3.6 9h16.8" />
        <path d="M3.6 15h16.8" />
        <path d="M12 3a14 14 0 0 1 0 18" />
        <path d="M12 3a14 14 0 0 0 0 18" />
      </IconSvg>
    );
  }

  return (
    <IconSvg>
      <rect height="14" rx="2" width="18" x="3" y="5" />
      <path d="M3 10h18" />
      <path d="M7 15h.01" />
      <path d="M11 15h2" />
    </IconSvg>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

export function AdminLayout() {
  const { t } = useTranslation();
  const { data: session } = useSuspenseQuery(adminSessionQueryOptions);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const currentNavItem =
    navItems.find((item) => item.to === pathname) ?? navItems[0];
  const drawerStateClass = desktopCollapsed
    ? 'is-drawer-close'
    : 'is-drawer-open';

  function closeDrawer() {
    setDrawerOpen(false);
  }

  return (
    <div
      className={`drawer lg:drawer-open min-h-screen bg-base-200 text-base-content ${drawerStateClass}`}
    >
      <input
        checked={drawerOpen}
        className="drawer-toggle"
        id="admin-drawer"
        onChange={(event) => setDrawerOpen(event.currentTarget.checked)}
        type="checkbox"
      />
      <div className="drawer-content flex min-h-screen flex-col">
        <header className="navbar sticky top-0 z-30 min-h-16 border-base-300 border-b bg-base-100/95 px-2 backdrop-blur sm:px-4 lg:px-6">
          <div className="flex-none lg:hidden">
            <button
              aria-controls="admin-drawer"
              aria-expanded={drawerOpen}
              aria-label={t('layout.openNavigation')}
              className="btn btn-ghost btn-square"
              onClick={() => setDrawerOpen(true)}
              type="button"
            >
              <MenuIcon />
            </button>
          </div>
          <div className="min-w-0 flex-1 px-2">
            <p className="truncate font-bold text-base sm:text-lg">
              {t(currentNavItem.labelKey)}
            </p>
            <p className="hidden truncate text-base-content/60 text-sm sm:block">
              {t('app.subtitle')}
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="avatar avatar-placeholder">
              <div className="w-9 rounded-full bg-primary text-primary-content">
                <span className="font-bold text-sm">T</span>
              </div>
            </div>
            <div className="flex min-w-0 flex-col items-end">
              <span className="max-w-28 truncate font-medium text-xs sm:max-w-48 sm:text-sm lg:max-w-64">
                {session.user.email}
              </span>
              <span className="badge badge-ghost badge-xs sm:badge-sm">
                {session.user.managed_by}
              </span>
            </div>
          </div>
        </header>
        <main
          aria-label={t('layout.content')}
          className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-8"
        >
          <Outlet />
        </main>
      </div>
      <div className="drawer-side z-40 lg:sticky lg:top-0 lg:h-screen">
        <label
          aria-label={t('layout.closeNavigation')}
          className="drawer-overlay"
          htmlFor="admin-drawer"
        />
        <aside className="flex min-h-full w-72 flex-col border-base-300 border-r bg-base-100 transition-all lg:is-drawer-close:w-20 lg:is-drawer-open:w-72">
          <div className="flex h-16 items-center gap-3 border-base-300 border-b px-4">
            <div className="avatar avatar-placeholder shrink-0">
              <div className="w-10 rounded-box bg-primary text-primary-content">
                <span className="font-bold text-lg">T</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 lg:is-drawer-close:hidden">
              <p className="truncate font-bold">{t('app.title')}</p>
              <p className="truncate text-base-content/60 text-xs">
                {session.user.email}
              </p>
            </div>
            <button
              aria-controls="admin-navigation"
              aria-expanded={!desktopCollapsed}
              aria-label={t('layout.toggleNavigation')}
              className="btn btn-ghost btn-square btn-sm hidden lg:inline-flex"
              onClick={() => setDesktopCollapsed(!desktopCollapsed)}
              type="button"
            >
              <MenuIcon />
            </button>
          </div>
          <nav
            aria-label={t('nav.label')}
            className="flex-1 overflow-y-auto p-3"
            id="admin-navigation"
          >
            <ul className="menu gap-1 p-0">
              {navItems.map((item) => {
                const isActive = item.to === pathname;

                return (
                  <li key={item.to}>
                    <Link
                      aria-current={isActive ? 'page' : undefined}
                      className={`lg:is-drawer-close:tooltip lg:is-drawer-close:tooltip-right gap-3 ${isActive ? 'active' : ''}`}
                      data-tip={t(item.labelKey)}
                      onClick={closeDrawer}
                      to={item.to}
                    >
                      <NavIcon name={item.icon} />
                      <span className="lg:is-drawer-close:hidden">
                        {t(item.labelKey)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}

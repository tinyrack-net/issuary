import { Link, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

const navItems = [
  { to: '/', labelKey: 'nav.dashboard' },
  { to: '/users', labelKey: 'nav.users' },
  { to: '/oauth-clients', labelKey: 'nav.oauthClients' },
  { to: '/audit-events', labelKey: 'nav.auditEvents' },
];

export function AdminLayout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      <header className="border-base-300 border-b bg-base-100/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="font-bold text-xl">{t('app.title')}</p>
            <p className="text-base-content/60 text-sm">{t('app.subtitle')}</p>
          </div>
          <nav aria-label={t('nav.label')} className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                activeProps={{ className: 'btn-primary' }}
                className="btn btn-ghost btn-sm"
                key={item.to}
                to={item.to}
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

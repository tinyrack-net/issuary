import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div
      className="drawer lg:drawer-open min-h-screen bg-[#07080b] text-slate-100"
      data-theme="dark"
    >
      <input
        checked={drawerOpen}
        className="drawer-toggle"
        id="admin-drawer"
        readOnly
        type="checkbox"
      />
      <div className="drawer-content relative flex min-h-screen flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_8%,rgba(113,112,255,0.22),transparent_32rem),radial-gradient(circle_at_85%_18%,rgba(16,185,129,0.10),transparent_28rem)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30" />

        <div className="navbar sticky top-0 z-20 border-white/10 border-b bg-[#0b0d12]/80 px-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl lg:px-8">
          <div className="flex-none lg:hidden">
            <button
              aria-controls="admin-drawer"
              aria-expanded={drawerOpen}
              aria-label={t('admin.nav.open')}
              className="btn btn-square btn-ghost border border-white/10 bg-white/[0.03]"
              onClick={() => setDrawerOpen(true)}
              type="button"
            >
              <span className="text-xl">☰</span>
            </button>
          </div>
          <div className="min-w-0 flex-1 gap-3">
            <nav
              aria-label={t('admin.breadcrumbLabel')}
              className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-slate-400 text-sm lg:flex"
            >
              <span>{t('admin.console')}</span>
              <span className="text-slate-600">/</span>
              <span className="font-medium text-slate-200">{title}</span>
            </nav>
            <div className="lg:hidden">
              <p className="font-semibold">{t('admin.mobileTitle')}</p>
              <p className="truncate text-slate-500 text-xs">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-none items-center gap-3">
            <span className="badge badge-primary badge-outline border-[#7170ff]/40 bg-[#7170ff]/10 text-[#c7c8ff]">
              {t('admin.environment')}
            </span>
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-slate-400 text-xs sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]" />
              {t('admin.livePolicy')}
            </div>
          </div>
        </div>

        <main className="relative z-10 mx-auto w-full max-w-[1500px] flex-1 px-4 py-8 lg:px-8">
          <div className="mb-8 overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035] shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl">
            <div className="relative p-6 lg:p-8">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7170ff]/70 to-transparent" />
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="font-semibold text-[#9da3ff] text-xs uppercase tracking-[0.26em]">
                    {t('admin.eyebrow')}
                  </p>
                  <h1 className="mt-3 font-semibold text-4xl text-slate-50 tracking-[-0.055em] lg:text-5xl">
                    {title}
                  </h1>
                  <p className="mt-3 max-w-2xl text-base text-slate-400 leading-7">
                    {description}
                  </p>
                </div>
                <div className="alert max-w-xl border-amber-300/20 bg-amber-300/10 py-3 text-amber-100 text-sm shadow-none">
                  <span className="text-amber-300">●</span>
                  <span>{t('admin.readonlyNotice')}</span>
                </div>
              </div>
            </div>
          </div>

          {children}
        </main>
      </div>

      <div className="drawer-side z-30">
        <button
          aria-controls="admin-drawer"
          aria-label={t('admin.nav.close')}
          className="drawer-overlay"
          onClick={() => setDrawerOpen(false)}
          type="button"
        />
        <aside className="flex min-h-full w-80 flex-col border-white/10 border-r bg-[#0b0d12]/95 p-5 shadow-[12px_0_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-4 flex justify-end lg:hidden">
              <button
                aria-controls="admin-drawer"
                aria-label={t('admin.nav.close')}
                className="btn btn-square btn-ghost btn-sm border border-white/10 bg-white/[0.03]"
                onClick={() => setDrawerOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="avatar placeholder">
                <div className="w-12 rounded-2xl bg-gradient-to-br from-[#7170ff] to-[#10b981] text-white shadow-[0_16px_40px_rgba(113,112,255,0.28)]">
                  <span className="font-semibold text-sm">TA</span>
                </div>
              </div>
              <div>
                <p className="font-semibold text-slate-50">TinyAuth</p>
                <p className="text-slate-500 text-xs">{t('admin.console')}</p>
              </div>
            </div>
          </div>

          <ul className="menu w-full gap-1 rounded-box bg-transparent p-0">
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

          <div className="card mt-auto border border-white/10 bg-white/[0.035] shadow-[0_16px_50px_rgba(0,0,0,0.2)]">
            <div className="card-body gap-2 p-4">
              <p className="font-semibold text-slate-500 text-xs uppercase tracking-[0.2em]">
                {t('admin.signedInAs')}
              </p>
              <p className="truncate font-medium text-slate-100 text-sm">
                {user.email}
              </p>
              <div className="mt-2">
                <span className="badge badge-outline border-white/15 bg-white/[0.04] text-slate-300">
                  {t('admin.roleBadge', {
                    role: formatAdminRole(t, user.role),
                  })}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
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
          ? 'active rounded-2xl border border-[#7170ff]/30 bg-[#7170ff]/15 text-slate-50'
          : 'rounded-2xl text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
      }
      to={to}
    >
      <span>{children}</span>
      {active ? (
        <span className="badge badge-primary badge-xs bg-[#7170ff]" />
      ) : null}
    </Link>
  );
}

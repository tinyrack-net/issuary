import type { useTranslation } from 'react-i18next';
import type { SessionUser } from '#frontend/queries/session.ts';

type Translate = ReturnType<typeof useTranslation>['t'];

/**
 * Both of these were copy-pasted across the shell and the two admin routes —
 * three copies of the role formatter, two of the source formatter — which is
 * how `tracking-wide` and `tracking-wider` ended up describing the same label
 * on two screens. One definition each.
 *
 * `AdminUser['role']` is assignable to `SessionUser['role']`, so this signature
 * serves both call sites.
 */
export function formatAdminRole(t: Translate, role: SessionUser['role']) {
  return role === 'admin'
    ? t('admin.users.roleAdmin')
    : t('admin.users.roleUser');
}

export function formatManagedBy(
  t: Translate,
  managedBy: 'database' | 'config',
) {
  return managedBy === 'database'
    ? t('admin.users.sourceDatabase')
    : t('admin.users.sourceConfig');
}

import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRTable } from '@tinyrack/ui/components/table';
import { TRText } from '@tinyrack/ui/components/text';
import { TRToolbar } from '@tinyrack/ui/components/toolbar';
import { useTranslation } from 'react-i18next';
import {
  formatAdminRole,
  formatManagedBy,
} from '#frontend/features/admin/format-admin-user.ts';
import type { AdminUser } from '#frontend/queries/admin-users.ts';

type AdminUsersTableProps = {
  users: AdminUser[];
  onEdit: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
};

export function AdminUsersTable({
  users,
  onEdit,
  onDelete,
}: AdminUsersTableProps) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto pb-tinyrack-sm">
      <TRTable.Root density="compact" striped>
        <TRTable.Header>
          <TRTable.Row>
            <TRTable.Head>{t('profile.email.label')}</TRTable.Head>
            <TRTable.Head>{t('admin.users.role')}</TRTable.Head>
            <TRTable.Head>{t('admin.users.source')}</TRTable.Head>
            <TRTable.Head>{t('admin.users.emailVerified')}</TRTable.Head>
            <TRTable.Head>{t('admin.users.secondFactor')}</TRTable.Head>
            <TRTable.Head>{t('admin.users.status')}</TRTable.Head>
            <TRTable.Head>{t('admin.users.actions')}</TRTable.Head>
          </TRTable.Row>
        </TRTable.Header>
        <TRTable.Body>
          {users.map((managedUser) => (
            <TRTable.Row key={managedUser.sub}>
              <TRTable.Cell>
                {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural identity stack; both values use TRText. */}
                <div className="flex flex-col gap-tinyrack-3xs">
                  <TRText as="div" variant="bodySm" weight="medium">
                    {managedUser.email}
                  </TRText>
                  <TRText
                    as="div"
                    className="max-w-tinyrack-measure-lg"
                    color="muted"
                    truncate
                    variant="code"
                  >
                    {managedUser.sub}
                  </TRText>
                </div>
              </TRTable.Cell>
              {/*
                `whitespace-nowrap` on every badge: without it a narrow
                viewport squeezes these columns until the labels break one
                letter per line. Keeping them intact makes the table wider
                than the phone, which is what the horizontal scroller below
                is for.
              */}
              <TRTable.Cell>
                <TRBadge
                  className="whitespace-nowrap"
                  uiSize="md"
                  variant={managedUser.role === 'admin' ? 'neutral' : undefined}
                >
                  {formatAdminRole(t, managedUser.role)}
                </TRBadge>
              </TRTable.Cell>
              <TRTable.Cell>
                <TRBadge
                  className="whitespace-nowrap"
                  uiSize="md"
                  variant={
                    managedUser.managed_by === 'config' ? 'warning' : 'info'
                  }
                >
                  {formatManagedBy(t, managedUser.managed_by)}
                </TRBadge>
              </TRTable.Cell>
              <TRTable.Cell>
                {managedUser.email_verified ? t('common.yes') : t('common.no')}
              </TRTable.Cell>
              <TRTable.Cell>
                {managedUser.totp_registered
                  ? t('admin.users.secondFactorTotp')
                  : managedUser.passkey_count > 0
                    ? t(
                        managedUser.passkey_count === 1
                          ? 'admin.users.secondFactorPasskey'
                          : 'admin.users.secondFactorPasskeys',
                        { count: managedUser.passkey_count },
                      )
                    : t('common.none')}
              </TRTable.Cell>
              <TRTable.Cell>
                {/*
                  `variant` here is a test contract: the directory test reads
                  `[data-variant="success"]` out of the row to assert the
                  status. Changing these tones breaks it.
                */}
                <TRBadge
                  className="whitespace-nowrap"
                  uiSize="md"
                  variant={managedUser.deleted_at ? 'danger' : 'success'}
                >
                  {managedUser.deleted_at
                    ? t('admin.users.deleted')
                    : t('admin.users.active')}
                </TRBadge>
              </TRTable.Cell>
              <TRTable.Cell>
                {managedUser.managed_by === 'database' &&
                !managedUser.deleted_at ? (
                  <TRToolbar.Root
                    aria-label={t('admin.users.actions')}
                    className="inline-flex whitespace-nowrap"
                  >
                    <TRButton
                      appearance="ghost"
                      aria-label={t('admin.users.editUser', {
                        email: managedUser.email,
                      })}
                      onClick={() => onEdit(managedUser)}
                      type="button"
                      uiSize="sm"
                    >
                      {t('admin.users.edit')}
                    </TRButton>
                    <TRButton
                      appearance="outline"
                      aria-label={t('admin.users.deleteUser', {
                        email: managedUser.email,
                      })}
                      intent="danger"
                      onClick={() => onDelete(managedUser)}
                      type="button"
                      uiSize="sm"
                    >
                      {t('admin.users.delete')}
                    </TRButton>
                  </TRToolbar.Root>
                ) : (
                  <TRBadge className="whitespace-nowrap" uiSize="md">
                    {t('admin.users.readonly')}
                  </TRBadge>
                )}
              </TRTable.Cell>
            </TRTable.Row>
          ))}
          {users.length === 0 ? (
            <TRTable.Row>
              <TRTable.Cell
                className="py-tinyrack-3xl text-center text-tinyrack-text-muted"
                colSpan={7}
              >
                {t('admin.users.emptyFiltered')}
              </TRTable.Cell>
            </TRTable.Row>
          ) : null}
        </TRTable.Body>
      </TRTable.Root>
    </div>
  );
}

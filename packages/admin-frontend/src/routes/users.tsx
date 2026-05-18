import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '#admin/components/page-header.js';
import { updateAdminUserRole } from '#admin/libs/api.js';
import {
  adminSessionQueryOptions,
  adminUsersQueryOptions,
} from '#admin/queries/admin.js';
import { queryKeys } from '#admin/queries/keys.js';

export function UsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: session } = useSuspenseQuery(adminSessionQueryOptions);
  const { data: users } = useSuspenseQuery(adminUsersQueryOptions);
  const updateRoleMutation = useMutation({
    mutationFn: updateAdminUserRole,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });

  return (
    <section>
      <PageHeader subtitle={t('users.subtitle')} title={t('users.title')} />
      {users.length === 0 ? (
        <div className="alert">{t('users.empty')}</div>
      ) : (
        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
          <table className="table">
            <thead>
              <tr>
                <th>{t('users.email')}</th>
                <th>{t('users.role')}</th>
                <th>{t('users.managedBy')}</th>
                <th>{t('users.status')}</th>
                <th>{t('users.action')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.sub}>
                  <td>
                    <div className="font-medium">{user.email}</div>
                    <div className="text-base-content/60 text-xs">
                      {user.sub}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-primary badge-outline">
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-ghost">{user.managed_by}</span>
                  </td>
                  <td>
                    {user.email_verified ? (
                      <span className="badge badge-success">
                        {t('users.emailVerified')}
                      </span>
                    ) : (
                      <span className="badge badge-warning">
                        {t('users.emailUnverified')}
                      </span>
                    )}
                  </td>
                  <td>
                    {(() => {
                      const nextRole = user.role === 'admin' ? 'user' : 'admin';
                      const disabled =
                        user.managed_by === 'config' ||
                        user.sub === session.user.sub ||
                        updateRoleMutation.isPending;

                      return (
                        <button
                          className="btn btn-outline btn-xs"
                          disabled={disabled}
                          onClick={() => {
                            updateRoleMutation.mutate({
                              sub: user.sub,
                              role: nextRole,
                            });
                          }}
                          title={
                            disabled
                              ? t('users.roleActionUnavailable')
                              : t('users.roleAction')
                          }
                          type="button"
                        >
                          {updateRoleMutation.isPending
                            ? t('users.updatingRole')
                            : nextRole === 'admin'
                              ? t('users.makeAdmin')
                              : t('users.makeUser')}
                        </button>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

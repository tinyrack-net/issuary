import { TRButton } from '@tinyrack/ui/components/button';
import { TRCheckbox } from '@tinyrack/ui/components/checkbox';
import { TRField } from '@tinyrack/ui/components/field';
import { TRForm } from '@tinyrack/ui/components/form';
import { TRInput } from '@tinyrack/ui/components/input';
import { TRSelect } from '@tinyrack/ui/components/select';
import { TRText } from '@tinyrack/ui/components/text';
import { CheckIcon, TriangleAlertIcon } from 'lucide-react';
import type { FormEvent } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';
import {
  parseUserRole,
  type UserModalState,
} from '#frontend/features/admin/users/admin-users-filters.ts';

type AdminUserFormModalProps = {
  modal: UserModalState;
  isMutating: boolean;
  onClose: () => void;
  onCreate: (values: {
    email: string;
    password: string;
    role: 'user' | 'admin';
    email_verified: boolean;
  }) => void;
  onUpdate: (values: {
    sub: string;
    email: string;
    role: 'user' | 'admin';
    email_verified: boolean;
  }) => void;
  onDelete: (sub: string) => void;
};

export function AdminUserFormModal({
  modal,
  isMutating,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: AdminUserFormModalProps) {
  const { t } = useTranslation();
  const defaultValues = useMemo(
    () => (modal?.type === 'edit' ? modal.user : null),
    [modal],
  );

  if (!modal) return null;

  if (modal.type === 'delete') {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title={t('admin.users.deleteTitle', { email: modal.user.email })}
        variant="destructive"
      >
        <div className="flex flex-col gap-tinyrack-xs rounded-tinyrack-md border border-tinyrack-danger-border bg-tinyrack-danger-surface p-tinyrack-lg text-tinyrack-danger-foreground">
          <div className="flex items-center gap-tinyrack-sm">
            <TriangleAlertIcon aria-hidden className="size-tinyrack-lg" />
            <TRText as="p" weight="medium">
              {t('admin.users.deleteWarning')}
            </TRText>
          </div>
          <TRText as="p" variant="bodySm">
            {t('admin.users.deleteDescription')}
          </TRText>
        </div>
        <ModalActions>
          <TRButton
            disabled={isMutating}
            onClick={onClose}
            type="button"
            uiSize="sm"
          >
            {t('admin.users.cancel')}
          </TRButton>
          <TRButton
            disabled={isMutating}
            intent="danger"
            onClick={() => onDelete(modal.user.sub)}
            type="button"
            uiSize="sm"
          >
            {t('admin.users.deleteConfirm')}
          </TRButton>
        </ModalActions>
      </Modal>
    );
  }

  const title =
    modal.type === 'create'
      ? t('admin.users.create')
      : t('admin.users.editTitle');
  const submit =
    modal.type === 'create'
      ? t('admin.users.createSubmit')
      : t('admin.users.save');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values = {
      email: String(formData.get('email') ?? ''),
      role: parseUserRole(formData.get('role')),
      email_verified: formData.get('email_verified') === 'on',
    };
    if (modal.type === 'create') {
      onCreate({
        ...values,
        password: String(formData.get('password') ?? ''),
      });
    } else {
      onUpdate({ sub: modal.user.sub, ...values });
    }
  };

  return (
    <Modal
      description={
        modal.type === 'create'
          ? t('admin.users.createHint')
          : t('admin.users.editHint')
      }
      isOpen
      onClose={onClose}
      title={title}
    >
      <TRForm
        className="mt-tinyrack-lg flex flex-col gap-tinyrack-lg"
        onSubmit={handleSubmit}
      >
        <TRField.Root>
          <TRField.Label htmlFor="admin-user-email">
            {t('profile.email.label')}
          </TRField.Label>
          <TRInput
            defaultValue={defaultValues?.email ?? ''}
            id="admin-user-email"
            name="email"
            required
            type="email"
            uiSize="sm"
          />
        </TRField.Root>

        {modal.type === 'create' ? (
          <TRField.Root>
            <TRField.Label htmlFor="admin-user-password">
              {t('admin.users.password')}
            </TRField.Label>
            <TRInput
              id="admin-user-password"
              name="password"
              required
              type="password"
              uiSize="sm"
            />
          </TRField.Root>
        ) : null}

        <TRField.Root>
          <TRField.Label htmlFor="admin-user-role">
            {t('admin.users.role')}
          </TRField.Label>
          <TRSelect.Root
            defaultValue={defaultValues?.role ?? 'user'}
            name="role"
          >
            <TRSelect.Trigger id="admin-user-role" uiSize="sm">
              <TRSelect.Value />
            </TRSelect.Trigger>
            <TRSelect.Positioner>
              <TRSelect.Popup>
                <TRSelect.List>
                  {['user', 'admin'].map((role) => (
                    <TRSelect.Item key={role} value={role}>
                      <TRSelect.ItemText>
                        {t(
                          `admin.users.role${role === 'user' ? 'User' : 'Admin'}`,
                        )}
                      </TRSelect.ItemText>
                      <TRSelect.ItemIndicator>
                        <CheckIcon aria-hidden />
                      </TRSelect.ItemIndicator>
                    </TRSelect.Item>
                  ))}
                </TRSelect.List>
              </TRSelect.Popup>
            </TRSelect.Positioner>
          </TRSelect.Root>
        </TRField.Root>

        <TRField.Root>
          <div className="flex items-center gap-tinyrack-md rounded-tinyrack-md border border-tinyrack-border bg-tinyrack-surface px-tinyrack-md py-tinyrack-sm">
            <TRCheckbox.Root
              aria-label={t('admin.users.emailVerified')}
              defaultChecked={defaultValues?.email_verified ?? false}
              name="email_verified"
              uiSize="lg"
              value="on"
            >
              <TRCheckbox.Indicator />
            </TRCheckbox.Root>
            <TRField.Label className="cursor-pointer">
              {t('admin.users.emailVerified')}
            </TRField.Label>
          </div>
        </TRField.Root>

        <ModalActions>
          <TRButton
            disabled={isMutating}
            onClick={onClose}
            type="button"
            uiSize="sm"
          >
            {t('admin.users.cancel')}
          </TRButton>
          <TRButton
            disabled={isMutating}
            intent="primary"
            type="submit"
            uiSize="sm"
          >
            {submit}
          </TRButton>
        </ModalActions>
      </TRForm>
    </Modal>
  );
}

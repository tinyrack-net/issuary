import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRField } from '@tinyrack/ui/components/field';
import { TRInput } from '@tinyrack/ui/components/input';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
import {
  CloudIcon,
  FingerprintIcon,
  PencilIcon,
  SmartphoneIcon,
  Trash2Icon,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod';
import { AlertBanner } from '#frontend/components/ui/alert-banner.tsx';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';
import { TinyAuthError } from '#frontend/libs/error.ts';
import { queryKeys } from '#frontend/queries/keys.ts';
import {
  deletePasskeyMutationOptions,
  getPasskeysQueryOptions,
  type PasskeyInfo,
  renamePasskeyMutationOptions,
} from '#frontend/queries/passkey.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';

interface ManagePasskeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNew: () => void;
}

export function ManagePasskeysModal({
  isOpen,
  onClose,
  onAddNew,
}: ManagePasskeysModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingPasskey, setEditingPasskey] = useState<PasskeyInfo | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: passkeysData, isLoading } = useQuery({
    ...getPasskeysQueryOptions,
    enabled: isOpen,
  });

  const deleteMutation = useMutation({
    ...deletePasskeyMutationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.passkeys() });
      queryClient.invalidateQueries({
        queryKey: getSessionQueryOptions.queryKey,
      });
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const handleClose = useCallback(() => {
    setEditingPasskey(null);
    setDeletingId(null);
    setConfirmingDeleteId(null);
    setDeleteError(null);
    onClose();
  }, [onClose]);

  const handleRequestDelete = (passkey: PasskeyInfo) => {
    setConfirmingDeleteId(passkey.id);
    setDeleteError(null);
  };

  const handleCancelDelete = () => {
    setConfirmingDeleteId(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async (passkey: PasskeyInfo) => {
    setDeletingId(passkey.id);
    setConfirmingDeleteId(null);
    try {
      await deleteMutation.mutateAsync({ id: passkey.id });
    } catch (error) {
      if (error instanceof TinyAuthError) {
        if (error.code === 'CANNOT_REMOVE_LAST_SECOND_FACTOR') {
          setDeleteError(
            t('profile.passkey.manageModal.cannotRemoveLastSecondFactor'),
          );
          return;
        }
      }
      setDeleteError(t('profile.passkey.manageModal.deleteError'));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const passkeys = passkeysData?.passkeys || [];

  return (
    <Modal
      icon={FingerprintIcon}
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      title={t('profile.passkey.manageModal.title')}
    >
      <div className="mt-4 space-y-2">
        {deleteError && (
          <AlertBanner variant="error">{deleteError}</AlertBanner>
        )}

        {isLoading && (
          <div className="flex justify-center py-6">
            <TRSpinner uiSize="md" />
          </div>
        )}

        {!isLoading && passkeys.length === 0 && (
          <div
            className="py-6 text-center text-tinyrack-sm text-tinyrack-text-muted"
            data-testid="passkeys-empty"
          >
            <p>{t('profile.passkey.manageModal.noPasskeys')}</p>
          </div>
        )}

        {!isLoading && passkeys.length > 0 && (
          <div className="flex flex-col gap-2">
            {passkeys.map((passkey) => (
              <PasskeyItem
                formatDate={formatDate}
                isConfirmingDelete={confirmingDeleteId === passkey.id}
                isDeleting={deletingId === passkey.id}
                isEditing={editingPasskey?.id === passkey.id}
                key={passkey.id}
                onCancelDelete={handleCancelDelete}
                onCancelEdit={() => setEditingPasskey(null)}
                onConfirmDelete={() => handleConfirmDelete(passkey)}
                onEdit={() => setEditingPasskey(passkey)}
                onRequestDelete={() => handleRequestDelete(passkey)}
                passkey={passkey}
              />
            ))}
          </div>
        )}
      </div>

      <ModalActions>
        <TRButton
          appearance="outline"
          data-testid="manage-passkeys-close"
          intent="neutral"
          onClick={handleClose}
          type="button"
          uiSize="sm"
        >
          {t('profile.passkey.manageModal.close')}
        </TRButton>
        <TRButton
          data-testid="manage-passkeys-add-new"
          intent="primary"
          onClick={() => {
            handleClose();
            onAddNew();
          }}
          type="button"
          uiSize="sm"
        >
          {t('profile.passkey.manageModal.addNew')}
        </TRButton>
      </ModalActions>
    </Modal>
  );
}

interface PasskeyItemProps {
  passkey: PasskeyInfo;
  isDeleting: boolean;
  isEditing: boolean;
  isConfirmingDelete: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  formatDate: (dateString: string) => string;
}

function PasskeyItem({
  passkey,
  isDeleting,
  isEditing,
  isConfirmingDelete,
  onEdit,
  onCancelEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  formatDate,
}: PasskeyItemProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t('validation.passkey.name.required'))
          .max(100, t('validation.passkey.name.max')),
      }),
    [t],
  );

  const form = useForm({
    resolver: standardSchemaResolver(schema),
    defaultValues: { name: passkey.name || '' },
  });

  const renameMutation = useMutation({
    ...renamePasskeyMutationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.passkeys() });
      onCancelEdit();
    },
  });

  const handleRename = form.handleSubmit(async (data) => {
    try {
      await renameMutation.mutateAsync({ id: passkey.id, name: data.name });
    } catch {
      form.setError('name', {
        message: t('profile.passkey.manageModal.renameError'),
      });
    }
  });

  if (isEditing) {
    return (
      <form
        className="flex flex-col gap-1.5 rounded-tinyrack-md bg-tinyrack-surface-muted p-2"
        onSubmit={handleRename}
      >
        <TRField.Root>
          <TRInput
            data-testid="passkey-rename-input"
            placeholder={t('profile.passkey.manageModal.namePlaceholder')}
            type="text"
            uiSize="sm"
            {...form.register('name')}
          />
          {form.formState.errors.name && (
            <div className="tr-field-error" data-testid="passkey-rename-error">
              {form.formState.errors.name.message}
            </div>
          )}
        </TRField.Root>
        <div className="flex justify-end gap-1">
          <TRButton
            appearance="ghost"
            disabled={renameMutation.isPending}
            onClick={() => {
              form.reset();
              onCancelEdit();
            }}
            type="button"
            uiSize="sm"
          >
            {t('profile.passkey.manageModal.cancelEdit')}
          </TRButton>
          <TRButton
            disabled={renameMutation.isPending}
            intent="primary"
            type="submit"
            uiSize="sm"
          >
            {renameMutation.isPending
              ? t('profile.passkey.manageModal.saving')
              : t('profile.passkey.manageModal.save')}
          </TRButton>
        </div>
      </form>
    );
  }

  if (isConfirmingDelete) {
    return (
      <div className="flex items-center justify-between rounded-tinyrack-md border border-tinyrack-danger-border bg-tinyrack-danger-surface p-2 text-tinyrack-on-danger">
        <div className="flex items-center gap-2">
          <Trash2Icon className="size-4" />
          <span className="text-tinyrack-xs">
            {t('profile.passkey.manageModal.deleteConfirmInline')}
          </span>
        </div>
        <div className="flex gap-1">
          <TRButton
            appearance="ghost"
            onClick={onCancelDelete}
            type="button"
            uiSize="sm"
          >
            {t('profile.passkey.manageModal.cancelEdit')}
          </TRButton>
          <TRButton
            intent="danger"
            onClick={onConfirmDelete}
            type="button"
            uiSize="sm"
          >
            {t('profile.passkey.manageModal.delete')}
          </TRButton>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between rounded-tinyrack-md bg-tinyrack-surface-muted p-2"
      data-testid="passkey-item"
    >
      <div className="flex items-center gap-2">
        {passkey.device_type === 'multiDevice' ? (
          <CloudIcon className="size-4 text-tinyrack-primary" />
        ) : (
          <SmartphoneIcon className="size-4 text-tinyrack-primary" />
        )}
        <div>
          <div className="font-medium text-tinyrack-xs">
            {passkey.name || t('profile.passkey.manageModal.unnamedPasskey')}
          </div>
          <div className="flex items-center gap-1.5 text-tinyrack-text-muted text-tinyrack-xs">
            <span>
              {t('profile.passkey.manageModal.createdAt', {
                date: formatDate(passkey.created_at),
              })}
            </span>
            {passkey.backed_up && (
              <TRBadge uiSize="sm" variant="success">
                {t('profile.passkey.manageModal.backedUp')}
              </TRBadge>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <TRButton
          appearance="ghost"
          aria-label={t('profile.passkey.manageModal.rename')}
          onClick={onEdit}
          type="button"
          uiSize="sm"
        >
          <PencilIcon className="size-3.5" />
        </TRButton>
        <TRButton
          appearance="ghost"
          aria-label={t('profile.passkey.manageModal.delete')}
          disabled={isDeleting}
          intent="danger"
          loading={isDeleting}
          onClick={onRequestDelete}
          type="button"
          uiSize="sm"
        >
          {isDeleting ? undefined : <Trash2Icon className="size-3.5" />}
        </TRButton>
      </div>
    </div>
  );
}

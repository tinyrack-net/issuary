import { AlertBanner } from '@frontend/components/ui/alert-banner.js';
import { Modal, ModalActions } from '@frontend/components/ui/modal.js';
import { TinyAuthError } from '@frontend/libs/error.js';
import { queryKeys } from '@frontend/queries/keys';
import {
  deletePasskeyMutationOptions,
  getPasskeysQueryOptions,
  type PasskeyInfo,
  renamePasskeyMutationOptions,
} from '@frontend/queries/passkey.js';
import { getSessionQueryOptions } from '@frontend/queries/session.js';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  CloudIcon,
  DeviceMobileIcon,
  FingerprintIcon,
  PencilSimpleIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod';

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
            <span className="loading loading-spinner loading-md" />
          </div>
        )}

        {!isLoading && passkeys.length === 0 && (
          <div
            className="py-6 text-center text-base-content/60 text-sm"
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
        <button
          className="btn btn-sm"
          data-testid="manage-passkeys-close"
          onClick={handleClose}
          type="button"
        >
          {t('profile.passkey.manageModal.close')}
        </button>
        <button
          className="btn btn-sm btn-primary"
          data-testid="manage-passkeys-add-new"
          onClick={() => {
            handleClose();
            onAddNew();
          }}
          type="button"
        >
          {t('profile.passkey.manageModal.addNew')}
        </button>
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
        className="flex flex-col gap-1.5 rounded-lg bg-base-200 p-2"
        onSubmit={handleRename}
      >
        <input
          className={`input input-bordered input-sm w-full ${
            form.formState.errors.name ? 'input-error' : ''
          }`}
          data-testid="passkey-rename-input"
          placeholder={t('profile.passkey.manageModal.namePlaceholder')}
          type="text"
          {...form.register('name')}
        />
        {form.formState.errors.name && (
          <span
            className="text-error text-xs"
            data-testid="passkey-rename-error"
          >
            {form.formState.errors.name.message}
          </span>
        )}
        <div className="flex justify-end gap-1">
          <button
            className="btn btn-ghost btn-xs"
            disabled={renameMutation.isPending}
            onClick={() => {
              form.reset();
              onCancelEdit();
            }}
            type="button"
          >
            {t('profile.passkey.manageModal.cancelEdit')}
          </button>
          <button
            className="btn btn-primary btn-xs"
            disabled={renameMutation.isPending}
            type="submit"
          >
            {renameMutation.isPending
              ? t('profile.passkey.manageModal.saving')
              : t('profile.passkey.manageModal.save')}
          </button>
        </div>
      </form>
    );
  }

  if (isConfirmingDelete) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-error/10 p-2">
        <div className="flex items-center gap-2">
          <TrashIcon className="size-4 text-error" weight="regular" />
          <span className="text-error text-xs">
            {t('profile.passkey.manageModal.deleteConfirmInline')}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            className="btn btn-ghost btn-xs"
            onClick={onCancelDelete}
            type="button"
          >
            {t('profile.passkey.manageModal.cancelEdit')}
          </button>
          <button
            className="btn btn-error btn-xs"
            onClick={onConfirmDelete}
            type="button"
          >
            {t('profile.passkey.manageModal.delete')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between rounded-lg bg-base-200 p-2"
      data-testid="passkey-item"
    >
      <div className="flex items-center gap-2">
        {passkey.device_type === 'multiDevice' ? (
          <CloudIcon className="size-4 text-primary" weight="regular" />
        ) : (
          <DeviceMobileIcon className="size-4 text-primary" weight="regular" />
        )}
        <div>
          <div className="font-medium text-xs">
            {passkey.name || t('profile.passkey.manageModal.unnamedPasskey')}
          </div>
          <div className="flex items-center gap-1.5 text-base-content/60 text-xs">
            <span>
              {t('profile.passkey.manageModal.createdAt', {
                date: formatDate(passkey.created_at),
              })}
            </span>
            {passkey.backed_up && (
              <span className="badge badge-success badge-xs">
                {t('profile.passkey.manageModal.backedUp')}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <button
          aria-label={t('profile.passkey.manageModal.rename')}
          className="btn btn-ghost btn-xs"
          onClick={onEdit}
          type="button"
        >
          <PencilSimpleIcon className="size-3.5" weight="regular" />
        </button>
        <button
          aria-label={t('profile.passkey.manageModal.delete')}
          className="btn btn-ghost btn-xs text-error"
          disabled={isDeleting}
          onClick={onRequestDelete}
          type="button"
        >
          {isDeleting ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <TrashIcon className="size-3.5" weight="regular" />
          )}
        </button>
      </div>
    </div>
  );
}

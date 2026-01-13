import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  CloudIcon,
  DeviceMobileIcon,
  PencilSimpleIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import z from 'zod/v4';
import { Modal, ModalActions } from '@/components/ui/modal';
import { queryKeys } from '@/queries/keys';
import {
  deletePasskeyMutationOptions,
  getPasskeysQueryOptions,
  type PasskeyInfo,
  renamePasskeyMutationOptions,
} from '@/queries/passkey.js';
import { getSessionQueryOptions } from '@/queries/session.js';

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
    onClose();
  }, [onClose]);

  const handleDelete = async (passkey: PasskeyInfo) => {
    const passkeyName =
      passkey.name || t('profile.passkey.manageModal.unnamedPasskey');
    if (
      !window.confirm(
        t('profile.passkey.manageModal.deleteConfirm', { name: passkeyName }),
      )
    ) {
      return;
    }
    setDeletingId(passkey.id);
    try {
      await deleteMutation.mutateAsync({ id: passkey.id });
    } catch {
      alert(t('profile.passkey.manageModal.deleteError'));
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
      isOpen={isOpen}
      onClose={handleClose}
      title={t('profile.passkey.manageModal.title')}
      size="lg"
    >
      <div className="py-4">
        {isLoading && (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg" />
          </div>
        )}

        {!isLoading && passkeys.length === 0 && (
          <div className="py-8 text-center text-base-content/60">
            <p>{t('profile.passkey.manageModal.noPasskeys')}</p>
          </div>
        )}

        {!isLoading && passkeys.length > 0 && (
          <div className="flex flex-col gap-2">
            {passkeys.map((passkey) => (
              <PasskeyItem
                key={passkey.id}
                passkey={passkey}
                isDeleting={deletingId === passkey.id}
                isEditing={editingPasskey?.id === passkey.id}
                onEdit={() => setEditingPasskey(passkey)}
                onCancelEdit={() => setEditingPasskey(null)}
                onDelete={() => handleDelete(passkey)}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      <ModalActions>
        <button type="button" className="btn" onClick={handleClose}>
          {t('profile.passkey.manageModal.close')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            handleClose();
            onAddNew();
          }}
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
  onEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  formatDate: (dateString: string) => string;
}

function PasskeyItem({
  passkey,
  isDeleting,
  isEditing,
  onEdit,
  onCancelEdit,
  onDelete,
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
        onSubmit={handleRename}
        className="flex flex-col gap-2 rounded-lg bg-base-200 p-3"
      >
        <input
          type="text"
          className={`input input-bordered input-sm w-full ${
            form.formState.errors.name ? 'input-error' : ''
          }`}
          placeholder={t('profile.passkey.manageModal.namePlaceholder')}
          {...form.register('name')}
        />
        {form.formState.errors.name && (
          <span className="text-error text-xs">
            {form.formState.errors.name.message}
          </span>
        )}
        <div className="flex justify-end gap-1">
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => {
              form.reset();
              onCancelEdit();
            }}
            disabled={renameMutation.isPending}
          >
            {t('profile.passkey.manageModal.cancelEdit')}
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-xs"
            disabled={renameMutation.isPending}
          >
            {renameMutation.isPending
              ? t('profile.passkey.manageModal.saving')
              : t('profile.passkey.manageModal.save')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg bg-base-200 p-3">
      <div className="flex items-center gap-3">
        {passkey.device_type === 'multiDevice' ? (
          <CloudIcon className="size-5 text-primary" weight="regular" />
        ) : (
          <DeviceMobileIcon className="size-5 text-primary" weight="regular" />
        )}
        <div>
          <div className="font-medium text-sm">
            {passkey.name || t('profile.passkey.manageModal.unnamedPasskey')}
          </div>
          <div className="flex items-center gap-2 text-base-content/60 text-xs">
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
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={onEdit}
          aria-label={t('profile.passkey.manageModal.rename')}
        >
          <PencilSimpleIcon className="size-4" weight="regular" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs text-error"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label={t('profile.passkey.manageModal.delete')}
        >
          {isDeleting ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <TrashIcon className="size-4" weight="regular" />
          )}
        </button>
      </div>
    </div>
  );
}

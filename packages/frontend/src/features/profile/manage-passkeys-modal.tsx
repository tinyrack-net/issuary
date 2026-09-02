import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRForm } from '@tinyrack/ui/components/form';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
import { TRText } from '@tinyrack/ui/components/text';
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
import { AuthField } from '#frontend/components/auth/auth-field.tsx';
import { AlertBanner } from '#frontend/components/ui/alert-banner.tsx';
import { Modal, ModalActions } from '#frontend/components/ui/modal.tsx';
import { IssuaryError } from '#frontend/libs/error.ts';
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
      if (error instanceof IssuaryError) {
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
      {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural modal body containing DS feedback and passkey rows. */}
      <div className="mt-tinyrack-lg flex flex-col gap-tinyrack-sm">
        {deleteError && (
          <AlertBanner variant="error">{deleteError}</AlertBanner>
        )}

        {isLoading && (
          <div className="flex justify-center py-tinyrack-xl">
            <TRSpinner uiSize="md" />
          </div>
        )}

        {!isLoading && passkeys.length === 0 && (
          <TRText
            align="center"
            className="py-tinyrack-xl"
            color="muted"
            data-testid="passkeys-empty"
            variant="bodySm"
          >
            {t('profile.passkey.manageModal.noPasskeys')}
          </TRText>
        )}

        {!isLoading && passkeys.length > 0 && (
          /* tinyrack-check-ignore-next-line components/no-native-text -- Structural list containing PasskeyItem components. */
          <div className="flex flex-col gap-tinyrack-sm">
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
      <TRForm
        className="flex flex-col gap-tinyrack-xs rounded-tinyrack-md bg-tinyrack-surface-muted p-tinyrack-sm"
        onSubmit={handleRename}
      >
        <AuthField
          data-testid="passkey-rename-input"
          error={form.formState.errors.name}
          errorTestId="passkey-rename-error"
          hideLabel
          label={t('profile.passkey.manageModal.nameLabel')}
          placeholder={t('profile.passkey.manageModal.namePlaceholder')}
          {...form.register('name')}
          type="text"
        />
        <div className="flex justify-end gap-tinyrack-xs">
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
      </TRForm>
    );
  }

  if (isConfirmingDelete) {
    return (
      /* tinyrack-check-ignore-next-line components/no-native-text -- Structural inline confirmation row; copy uses TRText and actions are DS controls. */
      <div className="flex items-center justify-between rounded-tinyrack-md border border-tinyrack-danger-border bg-tinyrack-danger-surface p-tinyrack-sm text-tinyrack-danger-foreground">
        <div className="flex items-center gap-tinyrack-sm">
          <Trash2Icon className="size-tinyrack-lg" />
          <TRText color="danger" variant="caption">
            {t('profile.passkey.manageModal.deleteConfirmInline')}
          </TRText>
        </div>
        <div className="flex gap-tinyrack-xs">
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
    /* tinyrack-check-ignore-next-line components/no-native-text -- Structural passkey row; visible copy uses TRText. */
    <div
      className="flex items-center justify-between rounded-tinyrack-md bg-tinyrack-surface-muted p-tinyrack-sm"
      data-testid="passkey-item"
    >
      {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural passkey identity group. */}
      <div className="flex items-center gap-tinyrack-sm">
        {passkey.device_type === 'multiDevice' ? (
          <CloudIcon className="size-tinyrack-lg text-tinyrack-primary-foreground" />
        ) : (
          <SmartphoneIcon className="size-tinyrack-lg text-tinyrack-primary-foreground" />
        )}
        {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural identity stack containing TRText parts. */}
        <div>
          <TRText variant="caption" weight="medium">
            {passkey.name || t('profile.passkey.manageModal.unnamedPasskey')}
          </TRText>
          {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural metadata row containing TRText and an optional badge. */}
          <div className="flex items-center gap-tinyrack-xs">
            <TRText color="muted" variant="caption">
              {t('profile.passkey.manageModal.createdAt', {
                date: formatDate(passkey.created_at),
              })}
            </TRText>
            {passkey.backed_up && (
              <TRBadge uiSize="md" variant="success">
                {t('profile.passkey.manageModal.backedUp')}
              </TRBadge>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-tinyrack-xs">
        <TRButton
          appearance="ghost"
          aria-label={t('profile.passkey.manageModal.rename')}
          onClick={onEdit}
          type="button"
          uiSize="sm"
        >
          <PencilIcon className="size-tinyrack-lg" />
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
          {isDeleting ? undefined : <Trash2Icon className="size-tinyrack-lg" />}
        </TRButton>
      </div>
    </div>
  );
}

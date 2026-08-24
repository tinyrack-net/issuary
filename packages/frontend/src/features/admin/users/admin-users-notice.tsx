import { TRAlert } from '@tinyrack/ui/components/alert';
import { TRButton } from '@tinyrack/ui/components/button';
import { CheckIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NoticeState } from '#frontend/features/admin/users/admin-users-filters.ts';

type AdminUsersNoticeProps = {
  notice: NonNullable<NoticeState>;
  onDismiss: () => void;
};

/**
 * Result of the last create/update/delete.
 *
 * Stays an inline banner rather than becoming a toast now that the shell
 * mounts a viewport: Base UI renders toasts as `dialog`/`alertdialog` inside a
 * `region`, never as a live `status`, so a toast would silently drop the
 * polite announcement this makes.
 */
export function AdminUsersNotice({ notice, onDismiss }: AdminUsersNoticeProps) {
  const { t } = useTranslation();
  const isSuccess = notice.tone === 'success';

  return (
    <TRAlert.Root
      aria-live={isSuccess ? 'polite' : 'assertive'}
      role={isSuccess ? 'status' : 'alert'}
      variant={isSuccess ? 'success' : 'danger'}
    >
      {isSuccess ? (
        <CheckIcon aria-hidden className="size-tinyrack-xl" />
      ) : (
        <TriangleAlertIcon aria-hidden className="size-tinyrack-xl" />
      )}
      <TRAlert.Title>{notice.message}</TRAlert.Title>
      <TRButton
        appearance="ghost"
        aria-label={t('common.close')}
        className="ms-auto"
        onClick={onDismiss}
        type="button"
        uiSize="sm"
      >
        <XIcon aria-hidden className="size-tinyrack-lg" />
      </TRButton>
    </TRAlert.Root>
  );
}

import { XIcon } from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

type TermsContentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
};

export function TermsContentModal({
  isOpen,
  onClose,
  title,
  content,
}: TermsContentModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      onClose={onClose}
    >
      <div className="modal-box max-h-[80vh] max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-lg">{title}</h3>
          <button
            type="button"
            className="btn btn-circle btn-ghost btn-sm"
            onClick={onClose}
            aria-label={t('terms.modal.close')}
          >
            <XIcon className="size-5" />
          </button>
        </div>
        <div
          className="prose prose-sm max-h-[60vh] max-w-none overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </dialog>
  );
}

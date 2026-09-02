import { Modal } from '#frontend/components/ui/modal.tsx';
import { SanitizedRichText } from '#frontend/components/ui/sanitized-rich-text.tsx';

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
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title={title}>
      <SanitizedRichText
        className="mt-tinyrack-md max-h-dvh overflow-y-auto"
        html={content}
      />
    </Modal>
  );
}

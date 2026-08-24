import { Modal } from '#frontend/components/ui/modal.tsx';

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
      <div
        className="prose prose-sm mt-tinyrack-md max-h-dvh overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </Modal>
  );
}

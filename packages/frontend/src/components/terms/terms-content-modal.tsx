import { Modal } from '#frontend/components/ui/modal.js';

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
        className="prose prose-sm mt-3 max-h-[55vh] max-w-none overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </Modal>
  );
}

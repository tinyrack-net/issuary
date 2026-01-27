import { Modal } from '@/components/ui/modal.js';

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
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div
        className="prose prose-sm mt-4 max-h-[60vh] max-w-none overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </Modal>
  );
}

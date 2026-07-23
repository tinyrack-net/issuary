import type { Icon } from '@phosphor-icons/react';
import { XIcon } from '@phosphor-icons/react';
import { TRDialog } from '@tinyrack/ui/components/dialog';
import { type ReactNode, useEffect } from 'react';

type ModalVariant = 'default' | 'destructive';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  preventClose?: boolean;
  icon?: Icon;
  variant?: ModalVariant;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
} as const;

const iconVariantClasses: Record<ModalVariant, string> = {
  default: 'bg-tinyrack-surface-muted text-tinyrack-text',
  destructive: 'bg-tinyrack-danger-surface text-tinyrack-danger',
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  preventClose = false,
  icon: IconComponent,
  variant = 'default',
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    if (preventClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, preventClose, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <TRDialog.Root
      defaultOpen
      disablePointerDismissal={preventClose}
      onOpenChange={(open) => {
        if (!open && !preventClose) {
          onClose();
        }
      }}
    >
      <TRDialog.Portal>
        <TRDialog.Viewport>
          <TRDialog.Backdrop />
          <TRDialog.Popup
            className={`max-h-[90vh] sm:max-h-[85vh] ${sizeClasses[size]}`}
          >
            <div className="flex items-start gap-2.5">
              {IconComponent && (
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconVariantClasses[variant]}`}
                >
                  <IconComponent className="size-4" weight="bold" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <TRDialog.Title className="font-bold text-tinyrack-md">
                  {title}
                </TRDialog.Title>
                {description && (
                  <TRDialog.Description className="mt-0.5 text-tinyrack-text-muted text-tinyrack-xs">
                    {description}
                  </TRDialog.Description>
                )}
              </div>
              {!preventClose && (
                <TRDialog.Close
                  aria-label="Close"
                  className="shrink-0"
                  data-testid="modal-close"
                >
                  <XIcon className="size-3.5" />
                </TRDialog.Close>
              )}
            </div>
            {children}
          </TRDialog.Popup>
        </TRDialog.Viewport>
      </TRDialog.Portal>
    </TRDialog.Root>
  );
}

interface ModalActionsProps {
  children: ReactNode;
}

export function ModalActions({ children }: ModalActionsProps) {
  return <div className="flex justify-end gap-2 pt-4">{children}</div>;
}

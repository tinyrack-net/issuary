import { TRDialog } from '@tinyrack/ui/components/dialog';
import type { LucideIcon } from 'lucide-react';
import { XIcon } from 'lucide-react';
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
  icon?: LucideIcon;
  variant?: ModalVariant;
}

/*
  Set through `--tr-dialog-box-max-width`, the override hook `.tr-dialog-box`
  exposes, rather than a `max-w-*` utility. The box feeds that same custom
  property into its own `width: min(…)` calculation, so a utility would move
  the max-width while leaving the width computation on the old value.

  This is the current design system overlay scale (20/32rem), not Tailwind's
  width scale. The local `lg` compatibility option now resolves to the largest
  supported overlay token, and `md` remains the unstyled `TRDialog` default.
*/
const sizeClasses = {
  sm: '[--tr-dialog-box-max-width:var(--tinyrack-overlay-width-sm)]',
  md: '[--tr-dialog-box-max-width:var(--tinyrack-overlay-width-md)]',
  lg: '[--tr-dialog-box-max-width:var(--tinyrack-overlay-width-md)]',
} as const;

const iconVariantClasses: Record<ModalVariant, string> = {
  default: 'bg-tinyrack-surface-muted text-tinyrack-text',
  destructive: 'bg-tinyrack-danger-surface text-tinyrack-danger-foreground',
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
          {/*
            No max-height here: `.tr-dialog-box` already clamps itself against
            `100dvh` minus the viewport gap, which is more correct than the
            `90vh`/`85vh` this used to override it with.
          */}
          <TRDialog.Popup className={sizeClasses[size]}>
            <div className="flex items-start gap-tinyrack-md">
              {IconComponent && (
                <div
                  className={`flex size-tinyrack-2xl shrink-0 items-center justify-center rounded-tinyrack-full ${iconVariantClasses[variant]}`}
                >
                  <IconComponent aria-hidden className="size-tinyrack-lg" />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-tinyrack-3xs">
                <TRDialog.Title>{title}</TRDialog.Title>
                {description && (
                  <TRDialog.Description className="text-tinyrack-text-muted text-tinyrack-xs">
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
                  <XIcon aria-hidden className="size-tinyrack-lg" />
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
  return (
    <div className="flex justify-end gap-tinyrack-sm pt-tinyrack-lg">
      {children}
    </div>
  );
}

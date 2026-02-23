import type { Icon } from '@phosphor-icons/react';
import { XIcon } from '@phosphor-icons/react';
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
  sm: 'max-w-[calc(100vw-2rem)] sm:max-w-sm',
  md: 'max-w-[calc(100vw-2rem)] sm:max-w-md',
  lg: 'max-w-[calc(100vw-2rem)] sm:max-w-lg',
} as const;

const iconVariantClasses: Record<ModalVariant, string> = {
  default: 'bg-primary/10 text-primary',
  destructive: 'bg-error/10 text-error',
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventClose) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, preventClose, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = () => {
    if (!preventClose) {
      onClose();
    }
  };

  return (
    <dialog className="modal modal-open">
      <div
        className={`modal-box max-h-[90vh] sm:max-h-[85vh] ${sizeClasses[size]}`}
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
            <h3 className="font-bold text-base">{title}</h3>
            {description && (
              <p className="mt-0.5 text-base-content/60 text-xs">
                {description}
              </p>
            )}
          </div>
          {!preventClose && (
            <button
              aria-label="Close"
              className="btn btn-circle btn-ghost btn-xs shrink-0"
              data-testid="modal-close"
              onClick={onClose}
              type="button"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
        {children}
      </div>
      <form className="modal-backdrop" method="dialog">
        <button onClick={handleBackdropClick} type="button">
          close
        </button>
      </form>
    </dialog>
  );
}

interface ModalActionsProps {
  children: ReactNode;
}

export function ModalActions({ children }: ModalActionsProps) {
  return <div className="modal-action">{children}</div>;
}

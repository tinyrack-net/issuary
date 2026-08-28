import { TRAlert } from '@tinyrack/ui/components/alert';
import type { LucideIcon } from 'lucide-react';

type AlertProps = {
  type: 'success' | 'error' | 'info' | 'warning';
  icon: LucideIcon;
  children: React.ReactNode;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  'data-testid'?: string;
};

const variantMap: Record<
  AlertProps['type'],
  'success' | 'danger' | 'info' | 'warning'
> = {
  success: 'success',
  error: 'danger',
  info: 'info',
  warning: 'warning',
};

export function Alert({
  type,
  icon: IconComponent,
  children,
  title,
  actions,
  className = '',
  'data-testid': dataTestid,
}: AlertProps) {
  return (
    <TRAlert.Root
      className={className}
      data-testid={dataTestid ?? `alert-${type}`}
      variant={variantMap[type]}
    >
      <IconComponent className="size-tinyrack-xl" />
      {title && <TRAlert.Title>{title}</TRAlert.Title>}
      <TRAlert.Description>{children}</TRAlert.Description>
      {actions && <TRAlert.Actions>{actions}</TRAlert.Actions>}
    </TRAlert.Root>
  );
}

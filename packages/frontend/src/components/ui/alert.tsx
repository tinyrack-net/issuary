import type { Icon } from '@phosphor-icons/react';
import { TRAlert } from '@tinyrack/ui/components/alert';

type AlertProps = {
  type: 'success' | 'error' | 'info' | 'warning';
  icon: Icon;
  children: React.ReactNode;
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
  className = '',
  'data-testid': dataTestid,
}: AlertProps) {
  return (
    <TRAlert.Root
      className={className}
      data-testid={dataTestid ?? `alert-${type}`}
      variant={variantMap[type]}
    >
      <IconComponent className="size-5" weight="fill" />
      <TRAlert.Title>{children}</TRAlert.Title>
    </TRAlert.Root>
  );
}

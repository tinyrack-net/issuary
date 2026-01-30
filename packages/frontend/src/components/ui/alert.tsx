import type { Icon } from '@phosphor-icons/react';

type AlertProps = {
  type: 'success' | 'error' | 'info' | 'warning';
  icon: Icon;
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
};

export function Alert({
  type,
  icon: IconComponent,
  children,
  className = '',
  'data-testid': testId,
}: AlertProps) {
  return (
    <div className={`alert alert-${type} ${className}`} data-testid={testId}>
      <IconComponent className="size-5" weight="fill" />
      <span>{children}</span>
    </div>
  );
}

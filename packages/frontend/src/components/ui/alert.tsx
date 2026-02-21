import type { Icon } from '@phosphor-icons/react';

type AlertProps = {
  type: 'success' | 'error' | 'info' | 'warning';
  icon: Icon;
  children: React.ReactNode;
  className?: string;
};

export function Alert({
  type,
  icon: IconComponent,
  children,
  className = '',
}: AlertProps) {
  return (
    <div className={`alert alert-${type} ${className}`}>
      <IconComponent className="size-5" weight="fill" />
      <span>{children}</span>
    </div>
  );
}

import {
  InfoIcon,
  WarningCircleIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';

type AlertBannerVariant = 'error' | 'warning' | 'info';

interface AlertBannerProps {
  variant: AlertBannerVariant;
  children: ReactNode;
}

const variantClasses: Record<AlertBannerVariant, string> = {
  error: 'bg-error/10 text-error',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
};

const variantIcons: Record<AlertBannerVariant, typeof WarningIcon> = {
  error: WarningCircleIcon,
  warning: WarningIcon,
  info: InfoIcon,
};

export function AlertBanner({ variant, children }: AlertBannerProps) {
  const IconComponent = variantIcons[variant];

  return (
    <div
      className={`flex items-start gap-3 rounded-lg p-3 ${variantClasses[variant]}`}
    >
      <IconComponent className="mt-0.5 size-5 shrink-0" weight="fill" />
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </div>
  );
}

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
  error: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  info: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
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
      data-testid={`alert-banner-${variant}`}
    >
      <IconComponent className="mt-0.5 size-5 shrink-0" weight="fill" />
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </div>
  );
}

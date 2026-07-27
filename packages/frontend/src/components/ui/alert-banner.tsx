import { CircleAlertIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert } from '#frontend/components/ui/alert.tsx';

type AlertBannerVariant = 'error' | 'warning' | 'info';

interface AlertBannerProps {
  variant: AlertBannerVariant;
  children: ReactNode;
}

const variantIcons: Record<AlertBannerVariant, typeof TriangleAlertIcon> = {
  error: CircleAlertIcon,
  warning: TriangleAlertIcon,
  info: InfoIcon,
};

/**
 * Status banner built on the design system's {@link Alert} (which wraps
 * `TRAlert`). Kept as a thin alias so existing call sites and the
 * `alert-banner-*` test ids stay stable while the visuals come from
 * `@tinyrack/ui`.
 */
export function AlertBanner({ variant, children }: AlertBannerProps) {
  return (
    <Alert
      data-testid={`alert-banner-${variant}`}
      icon={variantIcons[variant]}
      type={variant}
    >
      {children}
    </Alert>
  );
}

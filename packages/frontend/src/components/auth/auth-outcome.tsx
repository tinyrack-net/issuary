import { TRText } from '@tinyrack/ui/components/text';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type AuthOutcomeTone = 'success' | 'danger' | 'info';

type AuthOutcomeProps = {
  tone?: AuthOutcomeTone;
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Primary action, plus any secondary links. */
  children?: ReactNode;
};

const toneClasses: Record<AuthOutcomeTone, string> = {
  success: 'bg-tinyrack-success-surface text-tinyrack-success-foreground',
  danger: 'bg-tinyrack-danger-surface text-tinyrack-danger-foreground',
  info: 'bg-tinyrack-info-surface text-tinyrack-info-foreground',
};

/**
 * A screen that has nothing left to do but report what happened — email
 * verified, reset link sent, password changed, request failed.
 *
 * These previously existed as three or four divergent one-off layouts. Centred
 * here, because there is no form to scan and the single action should be the
 * focal point.
 */
export function AuthOutcome({
  tone = 'success',
  icon: Icon,
  title,
  description,
  children,
}: AuthOutcomeProps) {
  return (
    <div className="flex flex-col items-center gap-tinyrack-lg text-center">
      <span
        className={`flex size-tinyrack-3xl items-center justify-center rounded-tinyrack-full ${toneClasses[tone]}`}
      >
        <Icon aria-hidden className="size-tinyrack-xl" />
      </span>
      <div className="flex flex-col gap-tinyrack-xs">
        <TRText align="center" as="h2" variant="headingLg">
          {title}
        </TRText>
        {description && (
          <TRText align="center" as="p" color="muted" variant="body">
            {description}
          </TRText>
        )}
      </div>
      {children && (
        <div className="flex w-full flex-col items-center gap-tinyrack-sm">
          {children}
        </div>
      )}
    </div>
  );
}

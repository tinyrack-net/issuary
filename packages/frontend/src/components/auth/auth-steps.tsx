import { TRSteps } from '@tinyrack/ui/components/steps';
import { TRText } from '@tinyrack/ui/components/text';

type AuthStepsProps = {
  /** Ordered step labels. The current one is announced to assistive tech. */
  steps: string[];
  /** Zero-based index of the step being shown. */
  current: number;
  /** e.g. "Step {{current}} of {{total}}" — already interpolated by the caller. */
  progressLabel: string;
};

export function AuthSteps({ steps, current, progressLabel }: AuthStepsProps) {
  return (
    <div className="flex w-full flex-col gap-tinyrack-xs">
      <div className="flex items-baseline justify-between gap-tinyrack-sm">
        <TRText color="muted" variant="label">
          {progressLabel}
        </TRText>
        <TRText color="muted" variant="caption">
          {steps[current]}
        </TRText>
      </div>
      <TRSteps.Progress
        aria-label={progressLabel}
        current={current + 1}
        total={steps.length}
      />
    </div>
  );
}

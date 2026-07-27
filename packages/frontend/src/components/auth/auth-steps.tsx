import { TRText } from '@tinyrack/ui/components/text';

type AuthStepsProps = {
  /** Ordered step labels. The current one is announced to assistive tech. */
  steps: string[];
  /** Zero-based index of the step being shown. */
  current: number;
  /** e.g. "Step {{current}} of {{total}}" — already interpolated by the caller. */
  progressLabel: string;
};

/**
 * Progress indicator for the multi-step auth wizards.
 *
 * Not built on `TRSteps`: that component is a vertical, docs-prose ordered
 * list with an inline-start rail and absolutely positioned counters, and it
 * has no notion of a current or completed step. Forcing it horizontal would
 * mean overriding most of its CSS. A stateful, orientable stepper is worth
 * proposing upstream; until then this is a small token-only composition.
 *
 * Renders as a labelled group rather than a list, because the segments are
 * decorative — the text label carries the information.
 */
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
      <div
        aria-label={progressLabel}
        aria-valuemax={steps.length}
        aria-valuemin={1}
        aria-valuenow={current + 1}
        className="flex gap-tinyrack-xs"
        role="progressbar"
      >
        {steps.map((step, index) => (
          <span
            aria-hidden
            className={`h-tinyrack-xs flex-1 rounded-tinyrack-full transition-colors duration-tinyrack-normal ease-tinyrack-standard ${
              index <= current
                ? 'bg-tinyrack-primary'
                : 'bg-tinyrack-surface-hover'
            }`}
            key={step}
          />
        ))}
      </div>
    </div>
  );
}

import { TRSeparator } from '@tinyrack/ui/components/separator';
import { TRText } from '@tinyrack/ui/components/text';

type LabeledSeparatorProps = {
  /** Omit for a plain rule. */
  label?: string;
  className?: string;
};

/**
 * A rule that can carry a centred label ("or", "Terms").
 *
 * Two separators flank the label so the line reads as continuous. Replaces
 * the old `Divider` plus two hand-rolled copies of the same markup in the
 * register and terms screens.
 */
export function LabeledSeparator({
  label,
  className = '',
}: LabeledSeparatorProps) {
  if (!label) {
    return <TRSeparator className={className} orientation="horizontal" />;
  }

  return (
    <div className={`flex items-center gap-tinyrack-md ${className}`}>
      {/*
        The rules are wrapped rather than flexed directly: TRSeparator sets its
        own `inline-size`, which a width utility on the element does not
        override, so each rule would demand the full container width and the
        row would overflow as soon as the label is more than a word or two.
      */}
      <div className="min-w-0 flex-1">
        <TRSeparator orientation="horizontal" />
      </div>
      <TRText color="muted" variant="caption">
        {label}
      </TRText>
      <div className="min-w-0 flex-1">
        <TRSeparator orientation="horizontal" />
      </div>
    </div>
  );
}

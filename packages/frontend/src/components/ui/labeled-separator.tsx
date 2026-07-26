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
      <TRSeparator className="flex-1" orientation="horizontal" />
      <TRText color="muted" variant="caption">
        {label}
      </TRText>
      <TRSeparator className="flex-1" orientation="horizontal" />
    </div>
  );
}

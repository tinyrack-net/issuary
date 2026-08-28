import { TRText } from '@tinyrack/ui/components/text';

type AdminStatProps = {
  label: string;
  value: number;
  hint: string;
  /**
   * Token background class for the rule above the label. The dashboard uses it
   * to tell its three metrics apart; the users page has nothing to
   * differentiate and omits it.
   */
  accent?: string;
};

/**
 * One cell of a divided stat strip.
 *
 * The dashboard's `MetricStat` and the users page's `SummaryStat` were the same
 * component with different tails — one carried an accent rule, the other
 * hardcoded its hint. Parameterising both collapses them.
 */
export function AdminStat({ label, value, hint, accent }: AdminStatProps) {
  return (
    // tinyrack-check-ignore-next-line components/no-native-text -- Structural stat layout; all visible values use TRText.
    <div className="flex flex-1 flex-col gap-tinyrack-xs p-tinyrack-xl">
      {accent && (
        <div
          className={`mb-tinyrack-sm h-tinyrack-xs w-tinyrack-3xl rounded-tinyrack-full ${accent}`}
        />
      )}
      <TRText as="p" color="muted" variant="bodySm">
        {label}
      </TRText>
      <TRText as="p" variant="headingLg">
        {value}
      </TRText>
      <TRText as="p" color="muted" variant="caption">
        {hint}
      </TRText>
    </div>
  );
}

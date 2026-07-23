import { TRSeparator } from '@tinyrack/ui/components/separator';

type DividerProps = {
  text?: string;
  className?: string;
};

/**
 * Horizontal rule (optionally labeled) built on the design system's
 * `TRSeparator`. Two separators flank the optional centered label so the
 * rule reads as one continuous line.
 */
export function Divider({ text, className = '' }: DividerProps) {
  return (
    <div className={`my-4 flex items-center ${className}`}>
      <TRSeparator orientation="horizontal" style={{ flex: '1 1 0%' }} />
      {text && (
        <span className="px-3 text-tinyrack-sm text-tinyrack-text-muted">
          {text}
        </span>
      )}
      <TRSeparator orientation="horizontal" style={{ flex: '1 1 0%' }} />
    </div>
  );
}

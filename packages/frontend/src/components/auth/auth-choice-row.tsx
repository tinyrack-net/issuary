import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { TRText } from '@tinyrack/ui/components/text';
import { ChevronRightIcon, type LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

type AuthChoiceRowProps = {
  /**
   * The element the row navigates with, styled by `TRLinkButton`. These stay
   * real anchors with an `href` — the e2e suite selects the second-factor
   * choices by href, and they must survive a middle click.
   */
  render: ReactElement;
  icon?: LucideIcon;
  /** Replaces `icon` when the leading slot needs richer content (an avatar). */
  leading?: ReactNode;
  label: string;
  description?: string;
  /** Trailing slot outside the row's control, e.g. a remove button. */
  trailing?: ReactNode;
};

/**
 * A full-width, tappable row for picking one of several options.
 *
 * Used by the second-factor choosers and the account switcher, which each
 * hand-rolled a different version of the same thing — one as a stretched
 * button with a gap, another as a bare `<button>` inside a bordered div that
 * had no focus ring of its own.
 *
 * The row itself is one control, so it is a single tab stop and its label and
 * description are both part of its accessible name.
 */
export function AuthChoiceRow({
  render,
  icon: Icon,
  leading,
  label,
  description,
  trailing,
}: AuthChoiceRowProps) {
  return (
    <div className="flex items-center gap-tinyrack-xs">
      <TRLinkButton
        appearance="outline"
        className="h-auto min-w-0 flex-1 justify-start gap-tinyrack-md px-tinyrack-lg py-tinyrack-md text-start transition-colors duration-tinyrack-fast ease-tinyrack-standard"
        intent="neutral"
        render={render}
      >
        {leading ??
          (Icon ? <Icon aria-hidden className="size-5 shrink-0" /> : null)}
        <span className="flex min-w-0 flex-1 flex-col">
          <TRText truncate variant="body" weight="medium">
            {label}
          </TRText>
          {description && (
            <TRText color="muted" truncate variant="caption">
              {description}
            </TRText>
          )}
        </span>
        <ChevronRightIcon
          aria-hidden
          className="size-4 shrink-0 text-tinyrack-text-muted"
        />
      </TRLinkButton>
      {trailing}
    </div>
  );
}

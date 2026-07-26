import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { TRText } from '@tinyrack/ui/components/text';
import { ChevronRightIcon, type LucideIcon } from 'lucide-react';
import { createElement, type ElementType, type ReactNode } from 'react';

type AuthChoiceRowProps<C extends ElementType> = {
  as: C;
  icon?: LucideIcon;
  /** Replaces `icon` when the leading slot needs richer content (an avatar). */
  leading?: ReactNode;
  label: string;
  description?: string;
  /** Trailing slot for a badge or a secondary action. */
  trailing?: ReactNode;
} & Omit<React.ComponentPropsWithoutRef<C>, 'as' | 'children'>;

/**
 * A full-width, tappable row for picking one of several options.
 *
 * Used by the second-factor choosers and the account switcher, which each
 * hand-rolled a different version of the same thing — one as a stretched
 * button with a gap, another as a bare `<button>` inside a bordered div that
 * had no focus ring of its own.
 *
 * The whole row is one control, so there is a single tab stop and the label
 * and description are both part of its accessible name.
 */
export function AuthChoiceRow<C extends ElementType>({
  as: Component,
  icon: Icon,
  leading,
  label,
  description,
  trailing,
  ...rest
}: AuthChoiceRowProps<C>) {
  return (
    <div className="flex items-center gap-tinyrack-xs">
      <TRLinkButton
        appearance="outline"
        className="h-auto flex-1 justify-start gap-tinyrack-md px-tinyrack-lg py-tinyrack-md text-start transition-colors duration-tinyrack-fast ease-tinyrack-standard"
        intent="neutral"
        render={createElement(Component, rest)}
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

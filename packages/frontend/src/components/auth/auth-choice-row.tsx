import { TRCard } from '@tinyrack/ui/components/card';
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
  /** Non-interactive status shown inside the row, before the chevron. */
  indicator?: ReactNode;
  /** Highlights a card row as the currently selected choice. */
  selected?: boolean;
  /** Groups the choice and its trailing action inside one card surface. */
  surface?: 'standalone' | 'card';
  /** Trailing control beside the row, e.g. a remove button. */
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
  indicator,
  selected = false,
  surface = 'standalone',
  trailing,
}: AuthChoiceRowProps) {
  const choice = (
    <TRLinkButton
      appearance={surface === 'card' ? 'ghost' : 'outline'}
      className="h-auto min-w-0 flex-1 justify-start gap-tinyrack-md px-tinyrack-lg py-tinyrack-md text-start transition-colors duration-tinyrack-fast ease-tinyrack-standard"
      intent="neutral"
      render={render}
      uiSize="lg"
    >
      {leading ??
        (Icon ? (
          <Icon aria-hidden className="size-tinyrack-xl shrink-0" />
        ) : null)}
      {/*
        Wraps rather than truncates. These rows carry the only description of
        what each option does, and at phone width even the English strings
        exceed the available space — silently clipping them would hide the
        difference between the choices.
      */}
      {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural stack containing only TRText parts and an optional indicator. */}
      <span className="flex min-w-0 flex-1 flex-col whitespace-normal">
        <TRText className="min-w-0 break-words" variant="body" weight="medium">
          {label}
        </TRText>
        {description || indicator ? (
          /* tinyrack-check-ignore-next-line components/no-native-text -- Structural metadata row containing TRText and an optional badge. */
          <span className="flex flex-wrap items-center gap-x-tinyrack-xs gap-y-tinyrack-3xs">
            {description ? (
              <TRText color="muted" variant="caption">
                {description}
              </TRText>
            ) : null}
            {indicator}
          </span>
        ) : null}
      </span>
      <ChevronRightIcon
        aria-hidden
        className="size-tinyrack-lg shrink-0 text-tinyrack-text-muted"
      />
    </TRLinkButton>
  );

  if (surface === 'card') {
    return (
      <TRCard.Root
        className={`flex min-w-0 items-center transition-colors duration-tinyrack-fast ease-tinyrack-standard ${selected ? 'border-tinyrack-info-border bg-tinyrack-info-surface-subtle' : 'bg-tinyrack-surface-muted'}`}
        padding="none"
        variant="outlined"
      >
        {choice}
        {trailing ? (
          /* tinyrack-check-ignore-next-line components/no-native-text -- Structural action rail containing the supplied control. */
          <div className="flex shrink-0 items-center px-tinyrack-xs">
            {trailing}
          </div>
        ) : null}
      </TRCard.Root>
    );
  }

  return (
    /* tinyrack-check-ignore-next-line components/no-native-text -- Structural row; text is rendered by TRText and trailing is a control slot. */
    <div className="flex items-center gap-tinyrack-xs">
      {choice}
      {trailing}
    </div>
  );
}

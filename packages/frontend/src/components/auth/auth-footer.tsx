import { TRLink } from '@tinyrack/ui/components/link';
import { TRText } from '@tinyrack/ui/components/text';
import type { ReactElement, ReactNode } from 'react';

type AuthFooterProps = {
  children: ReactNode;
};

/**
 * The block of secondary navigation at the bottom of an auth screen.
 *
 * Several screens need more than one of these ("no account? sign up", "other
 * sign in options", "back to login"), so the footer owns the row layout and
 * each link is a child. The old `FooterLink` baked one prompt-and-link pair
 * plus its own margin into every call site, which is why six of them passed
 * an empty prompt just to get a bare link.
 */
export function AuthFooter({ children }: AuthFooterProps) {
  return (
    <div className="flex flex-col items-center gap-tinyrack-sm text-center">
      {children}
    </div>
  );
}

type AuthFooterLinkProps = {
  /** Optional lead-in, e.g. "Don't have an account?". */
  text?: string;
  /**
   * The link element itself, styled by `TRLink`. Passing the element rather
   * than an `as` component plus loose props keeps the router's `to`/`search`
   * types checked at the call site.
   */
  link: ReactElement;
};

export function AuthFooterLink({ text, link }: AuthFooterLinkProps) {
  return (
    <TRText color="muted" variant="caption">
      {text ? `${text} ` : null}
      <TRLink className="font-tinyrack-medium" render={link} />
    </TRText>
  );
}

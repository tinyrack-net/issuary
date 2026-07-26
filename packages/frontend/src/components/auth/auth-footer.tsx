import { TRLink } from '@tinyrack/ui/components/link';
import { TRText } from '@tinyrack/ui/components/text';
import { createElement, type ElementType, type ReactNode } from 'react';

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

type AuthFooterLinkProps<C extends ElementType> = {
  as: C;
  /** Optional lead-in, e.g. "Don't have an account?". */
  text?: string;
  linkText: string;
} & Omit<React.ComponentPropsWithoutRef<C>, 'as' | 'children'>;

export function AuthFooterLink<C extends ElementType>({
  as: Component,
  text,
  linkText,
  ...linkProps
}: AuthFooterLinkProps<C>) {
  return (
    <TRText color="muted" variant="caption">
      {text ? `${text} ` : null}
      <TRLink
        className="font-tinyrack-medium"
        render={createElement(Component, linkProps)}
      >
        {linkText}
      </TRLink>
    </TRText>
  );
}

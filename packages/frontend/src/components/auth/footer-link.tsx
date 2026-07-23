import { TRLink } from '@tinyrack/ui/components/link';
import { createElement, type ElementType } from 'react';

type FooterLinkProps<C extends ElementType> = {
  as: C;
  text: string;
  linkText: string;
  className?: string;
} & Record<string, unknown>;

export function FooterLink<C extends ElementType>({
  as: Component,
  text,
  linkText,
  className = '',
  ...linkProps
}: FooterLinkProps<C>) {
  return (
    <div
      className={`mt-6 text-center text-muted-foreground text-xs ${className}`}
    >
      {text}{' '}
      <TRLink
        className="font-medium"
        render={createElement(Component, linkProps as object)}
      >
        {linkText}
      </TRLink>
    </div>
  );
}
